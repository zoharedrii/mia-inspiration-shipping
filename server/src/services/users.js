// שירות משתמשים - שאילתות ועדכונים ל-DB עבור משתמשים
//
// משמש גם ב-auth (find) וגם ב-admin (יצירה / עדכון / השבתה / איפוס סיסמה).

import bcrypt from 'bcrypt';
import db from '../db/index.js';

const BCRYPT_ROUNDS = 10;
const VALID_ROLES = ['admin', 'accounting', 'warehouse', 'branch'];

/**
 * מחזיר משתמש לפי שם משתמש (כולל סיסמה מוצפנת - לשימוש פנימי בלבד!)
 */
export function findByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);
}

/**
 * מחזיר משתמש לפי ID, ללא הסיסמה (בטוח להחזיר ללקוח).
 * @param {boolean} includeInactive - האם לכלול משתמשים מושבתים
 */
export function findById(id, includeInactive = false) {
  const sql = `
    SELECT u.id, u.username, u.full_name, u.role, u.branch_id, u.is_active, u.created_at,
           b.name AS branch_name, b.code AS branch_code
    FROM users u
    LEFT JOIN branches b ON u.branch_id = b.id
    WHERE u.id = ?
    ${includeInactive ? '' : 'AND u.is_active = 1'}
  `;
  return db.prepare(sql).get(id);
}

/**
 * מחזיר את כל המשתמשים במערכת (כולל מושבתים), לטובת מסך ניהול.
 */
export function listAll() {
  return db
    .prepare(
      `SELECT u.id, u.username, u.full_name, u.role, u.branch_id, u.is_active, u.created_at,
              b.name AS branch_name, b.code AS branch_code, b.branch_number
       FROM users u
       LEFT JOIN branches b ON u.branch_id = b.id
       ORDER BY
         CASE u.role WHEN 'admin' THEN 1 WHEN 'warehouse' THEN 2 WHEN 'accounting' THEN 3 ELSE 4 END,
         u.is_active DESC,
         u.username ASC`
    )
    .all();
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
    throw Object.assign(new Error('שם משתמש חייב להכיל לפחות 2 תווים'), { statusCode: 400 });
  }
  if (!full_name || full_name.trim().length < 2) {
    throw Object.assign(new Error('שם מלא חייב להכיל לפחות 2 תווים'), { statusCode: 400 });
  }
  if (!VALID_ROLES.includes(role)) {
    throw Object.assign(new Error('תפקיד לא תקין'), { statusCode: 400 });
  }
  if ((role === 'branch' || role === 'warehouse') && !branch_id) {
    throw Object.assign(new Error('יש לבחור סניף עבור תפקיד זה'), { statusCode: 400 });
  }
  if (isCreate && (!password || password.length < 4)) {
    throw Object.assign(new Error('סיסמה חייבת להכיל לפחות 4 תווים'), { statusCode: 400 });
  }
}

/**
 * יצירת משתמש חדש
 */
export async function createUser(data) {
  validateUserData(data, { isCreate: true });

  const { username, password, full_name, role, branch_id } = data;

  // בדיקה ששם המשתמש פנוי
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
  if (existing) {
    throw Object.assign(new Error('שם המשתמש כבר תפוס'), { statusCode: 400 });
  }

  // בדיקה שהסניף קיים (אם נדרש)
  const finalBranchId = role === 'admin' || role === 'accounting' ? null : branch_id;
  if (finalBranchId) {
    const branch = db.prepare('SELECT id FROM branches WHERE id = ? AND is_active = 1').get(finalBranchId);
    if (!branch) {
      throw Object.assign(new Error('הסניף שנבחר אינו קיים או אינו פעיל'), { statusCode: 400 });
    }
  }

  const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const result = db
    .prepare(
      `INSERT INTO users (username, password_hash, full_name, role, branch_id)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(username.trim(), password_hash, full_name.trim(), role, finalBranchId);

  return findById(result.lastInsertRowid, true);
}

/**
 * עדכון פרטי משתמש (full_name, role, branch_id).
 * לא ניתן לעדכן username או סיסמה דרך הפונקציה הזו.
 */
export function updateUser(id, data) {
  validateUserData({ ...data, username: 'placeholder' }); // לא בודקים username

  const { full_name, role, branch_id } = data;

  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!existing) {
    throw Object.assign(new Error('המשתמש לא נמצא'), { statusCode: 404 });
  }

  const finalBranchId = role === 'admin' || role === 'accounting' ? null : branch_id;
  if (finalBranchId) {
    const branch = db.prepare('SELECT id FROM branches WHERE id = ? AND is_active = 1').get(finalBranchId);
    if (!branch) {
      throw Object.assign(new Error('הסניף שנבחר אינו קיים או אינו פעיל'), { statusCode: 400 });
    }
  }

  db.prepare(
    `UPDATE users SET full_name = ?, role = ?, branch_id = ? WHERE id = ?`
  ).run(full_name.trim(), role, finalBranchId, id);

  return findById(id, true);
}

/**
 * הפעלה / השבתה של משתמש (אין מחיקה אמיתית בגלל FK של משלוחים)
 */
export function setActive(id, isActive, currentUserId) {
  if (id === currentUserId) {
    throw Object.assign(new Error('לא ניתן להשבית את עצמך'), { statusCode: 400 });
  }

  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!existing) {
    throw Object.assign(new Error('המשתמש לא נמצא'), { statusCode: 404 });
  }

  db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(isActive ? 1 : 0, id);
  return findById(id, true);
}

/**
 * איפוס סיסמה - admin יכול לאפס סיסמה של כל משתמש
 */
export async function resetPassword(id, newPassword) {
  if (!newPassword || newPassword.length < 4) {
    throw Object.assign(new Error('סיסמה חייבת להכיל לפחות 4 תווים'), { statusCode: 400 });
  }

  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!existing) {
    throw Object.assign(new Error('המשתמש לא נמצא'), { statusCode: 404 });
  }

  const password_hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(password_hash, id);
  return { ok: true };
}
