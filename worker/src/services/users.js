// שירות משתמשים - שאילתות ועדכונים ל-D1 עבור משתמשים.
//
// כל הפונקציות אסינכרוניות ומקבלות את חיבור ה-DB (c.env.DB) כפרמטר ראשון,
// כי ב-Cloudflare Workers אין משתנה גלובלי של DB - הוא מגיע מתוך הבקשה.

import { hashPassword } from '../lib/password.js';
import { httpError } from '../lib/http.js';

const VALID_ROLES = ['admin', 'accounting', 'warehouse', 'branch'];

/**
 * מחזיר משתמש לפי שם משתמש (כולל סיסמה מוצפנת - לשימוש פנימי בלבד!)
 */
export async function findByUsername(db, username) {
  return db
    .prepare('SELECT * FROM users WHERE username = ? AND is_active = 1')
    .bind(username)
    .first();
}

/**
 * מחזיר משתמש לפי ID, ללא הסיסמה (בטוח להחזיר ללקוח).
 * @param {boolean} includeInactive - האם לכלול משתמשים מושבתים
 */
export async function findById(db, id, includeInactive = false) {
  const sql = `
    SELECT u.id, u.username, u.full_name, u.role, u.branch_id, u.is_active, u.created_at,
           u.password_reset_requested_at,
           b.name AS branch_name, b.code AS branch_code
    FROM users u
    LEFT JOIN branches b ON u.branch_id = b.id
    WHERE u.id = ?
    ${includeInactive ? '' : 'AND u.is_active = 1'}
  `;
  return db.prepare(sql).bind(id).first();
}

/**
 * מחזיר את כל המשתמשים במערכת (כולל מושבתים), לטובת מסך ניהול.
 */
export async function listAll(db) {
  const { results } = await db
    .prepare(
      `SELECT u.id, u.username, u.full_name, u.role, u.branch_id, u.is_active, u.created_at,
              u.password_reset_requested_at,
              b.name AS branch_name, b.code AS branch_code, b.branch_number
       FROM users u
       LEFT JOIN branches b ON u.branch_id = b.id
       ORDER BY
         u.password_reset_requested_at IS NULL,
         CASE u.role WHEN 'admin' THEN 1 WHEN 'warehouse' THEN 2 WHEN 'accounting' THEN 3 ELSE 4 END,
         u.is_active DESC,
         u.username ASC`
    )
    .all();
  return results;
}

/**
 * הסרת שדות רגישים לפני שליחה ללקוח
 */
export function sanitize(user) {
  if (!user) return null;
  const { password_hash, ...safe } = user;
  return safe;
}

// ============================================================
// פעולות ניהול (לאדמין בלבד)
// ============================================================

/**
 * וולידציה משותפת לנתוני משתמש
 */
function validateUserData({ username, full_name, role, branch_id, password }, { isCreate = false } = {}) {
  if (!username || username.trim().length < 2) {
    throw httpError('שם משתמש חייב להכיל לפחות 2 תווים', 400);
  }
  if (!full_name || full_name.trim().length < 2) {
    throw httpError('שם מלא חייב להכיל לפחות 2 תווים', 400);
  }
  if (!VALID_ROLES.includes(role)) {
    throw httpError('תפקיד לא תקין', 400);
  }
  if ((role === 'branch' || role === 'warehouse') && !branch_id) {
    throw httpError('יש לבחור סניף עבור תפקיד זה', 400);
  }
  if (isCreate && (!password || password.length < 4)) {
    throw httpError('סיסמה חייבת להכיל לפחות 4 תווים', 400);
  }
}

/**
 * יצירת משתמש חדש
 */
export async function createUser(db, data) {
  validateUserData(data, { isCreate: true });

  const { username, password, full_name, role, branch_id } = data;

  // בדיקה ששם המשתמש פנוי
  const existing = await db.prepare('SELECT id FROM users WHERE username = ?').bind(username.trim()).first();
  if (existing) {
    throw httpError('שם המשתמש כבר תפוס', 400);
  }

  // בדיקה שהסניף קיים (אם נדרש)
  const finalBranchId = role === 'admin' || role === 'accounting' ? null : branch_id;
  if (finalBranchId) {
    const branch = await db.prepare('SELECT id FROM branches WHERE id = ? AND is_active = 1').bind(finalBranchId).first();
    if (!branch) {
      throw httpError('הסניף שנבחר אינו קיים או אינו פעיל', 400);
    }
  }

  const password_hash = await hashPassword(password);

  const result = await db
    .prepare(
      `INSERT INTO users (username, password_hash, full_name, role, branch_id)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(username.trim(), password_hash, full_name.trim(), role, finalBranchId)
    .run();

  return findById(db, result.meta.last_row_id, true);
}

/**
 * עדכון פרטי משתמש (full_name, role, branch_id).
 * לא ניתן לעדכן username או סיסמה דרך הפונקציה הזו.
 */
export async function updateUser(db, id, data) {
  validateUserData({ ...data, username: 'placeholder' }); // לא בודקים username

  const { full_name, role, branch_id } = data;

  const existing = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  if (!existing) {
    throw httpError('המשתמש לא נמצא', 404);
  }

  const finalBranchId = role === 'admin' || role === 'accounting' ? null : branch_id;
  if (finalBranchId) {
    const branch = await db.prepare('SELECT id FROM branches WHERE id = ? AND is_active = 1').bind(finalBranchId).first();
    if (!branch) {
      throw httpError('הסניף שנבחר אינו קיים או אינו פעיל', 400);
    }
  }

  await db
    .prepare('UPDATE users SET full_name = ?, role = ?, branch_id = ? WHERE id = ?')
    .bind(full_name.trim(), role, finalBranchId, id)
    .run();

  return findById(db, id, true);
}

/**
 * הפעלה / השבתה של משתמש (אין מחיקה אמיתית בגלל FK של משלוחים)
 */
export async function setActive(db, id, isActive, currentUserId) {
  if (id === currentUserId) {
    throw httpError('לא ניתן להשבית את עצמך', 400);
  }

  const existing = await db.prepare('SELECT id FROM users WHERE id = ?').bind(id).first();
  if (!existing) {
    throw httpError('המשתמש לא נמצא', 404);
  }

  await db.prepare('UPDATE users SET is_active = ? WHERE id = ?').bind(isActive ? 1 : 0, id).run();
  return findById(db, id, true);
}

/**
 * איפוס סיסמה - admin יכול לאפס סיסמה של כל משתמש.
 * אם הייתה בקשת איפוס פתוחה — היא נסגרת אוטומטית.
 */
export async function resetPassword(db, id, newPassword) {
  if (!newPassword || newPassword.length < 4) {
    throw httpError('סיסמה חייבת להכיל לפחות 4 תווים', 400);
  }

  const existing = await db.prepare('SELECT id FROM users WHERE id = ?').bind(id).first();
  if (!existing) {
    throw httpError('המשתמש לא נמצא', 404);
  }

  const password_hash = await hashPassword(newPassword);
  await db
    .prepare(
      `UPDATE users
       SET password_hash = ?,
           password_reset_requested_at = NULL
       WHERE id = ?`
    )
    .bind(password_hash, id)
    .run();
  return { ok: true };
}

/**
 * בקשת איפוס סיסמה ע"י המשתמש עצמו (לפני התחברות).
 *
 * מטעמי אבטחה: גם אם המשתמש לא קיים — לא חושפים את זה ללקוח.
 * מחזירים תמיד הצלחה. אם המשתמש קיים — מסמנים שיש בקשה.
 */
export async function requestPasswordReset(db, username) {
  if (!username || !username.trim()) {
    throw httpError('יש להזין שם משתמש', 400);
  }

  const user = await db
    .prepare('SELECT id FROM users WHERE username = ? AND is_active = 1')
    .bind(username.trim())
    .first();

  if (user) {
    await db
      .prepare('UPDATE users SET password_reset_requested_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(user.id)
      .run();
    console.log(`🔔 [Auth] בקשת איפוס סיסמה עבור משתמש: ${username}`);
  }

  // תמיד מחזירים הצלחה - לא חושפים האם המשתמש קיים
  return { ok: true };
}
