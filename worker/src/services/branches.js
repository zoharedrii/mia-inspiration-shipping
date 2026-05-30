// שירות סניפים - שאילתות פשוטות על טבלת branches (D1).

/**
 * רשימת כל הסניפים הפעילים, ממוינים: מחסן ראשון ואז סניפים לפי שם.
 */
export async function getAllActive(db) {
  const { results } = await db
    .prepare(
      `SELECT id, code, name, city, address, contact_name, contact_phone, is_warehouse
       FROM branches
       WHERE is_active = 1
       ORDER BY is_warehouse DESC, name ASC`
    )
    .all();
  return results;
}

/**
 * סניף לפי ID
 */
export async function getById(db, id) {
  return db.prepare('SELECT * FROM branches WHERE id = ?').bind(id).first();
}
