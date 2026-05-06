// שירות סניפים - שאילתות פשוטות על טבלת branches

import db from '../db/index.js';

/**
 * רשימת כל הסניפים הפעילים, ממוינים: מחסן ראשון ואז סניפים לפי שם.
 */
export function getAllActive() {
  return db
    .prepare(
      `SELECT id, code, name, city, address, contact_name, contact_phone, is_warehouse
       FROM branches
       WHERE is_active = 1
       ORDER BY is_warehouse DESC, name ASC`
    )
    .all();
}

/**
 * סניף לפי ID
 */
export function getById(id) {
  return db.prepare('SELECT * FROM branches WHERE id = ?').get(id);
}
