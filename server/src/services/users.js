// שירות משתמשים - שאילתות ל-DB עבור משתמשים
//
// כל הקוד שמתעסק עם טבלת users עובר דרך הקובץ הזה.
// ככה אם נשנה את ה-DB בעתיד (PostgreSQL במקום SQLite) - שינוי במקום אחד.

import db from '../db/index.js';

/**
 * מחזיר משתמש לפי שם משתמש (כולל סיסמה מוצפנת - לשימוש פנימי בלבד!)
 */
export function findByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);
}

/**
 * מחזיר משתמש לפי ID, ללא הסיסמה (בטוח להחזיר ללקוח)
 */
export function findById(id) {
  return db
    .prepare(
      `SELECT u.id, u.username, u.full_name, u.role, u.branch_id, u.is_active, u.created_at,
              b.name AS branch_name, b.code AS branch_code
       FROM users u
       LEFT JOIN branches b ON u.branch_id = b.id
       WHERE u.id = ?`
    )
    .get(id);
}

/**
 * הסרת שדות רגישים לפני שליחה ללקוח
 */
export function sanitize(user) {
  if (!user) return null;
  const { password_hash, ...safe } = user;
  return safe;
}
