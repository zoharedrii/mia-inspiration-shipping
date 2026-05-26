// שירות משלוחים - הלוגיקה העסקית של ניהול משלוחים
//
// כל הקוד שמתעסק עם טבלת shipments עובר דרך הקובץ הזה.
// כולל יצירה, שאילתות, שינוי סטטוס, ורישום אוטומטי בהיסטוריה.

import db from '../db/index.js';
import { createTransportationOrder } from './orian/transportation.js';

const VALID_STATUSES = ['pending', 'sent', 'received', 'mismatch', 'cancelled'];
const VALID_PACKAGE_TYPES = ['01', '02', '03', '05']; // לפי מסמכי אוריין

/**
 * מחולל מזהה משלוח ייחודי בפורמט SHP-YYYYMMDD-XXXX
 * דוגמה: SHP-20260506-A3F2
 */
function generateReferenceId() {
  const date = new Date();
  const yyyymmdd = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `SHP-${yyyymmdd}-${random}`;
}

/**
 * יצירת משלוח חדש ב-DB.
 * הסטטוס ההתחלתי הוא 'pending'.
 *
 * אחרי שמירה ב-DB, השרת קורא ל-API של אוריין (בפועל או דמה לפי ORIAN_MODE)
 * ושומר את מזהה ההזמנה שהוחזר. אם אוריין נכשלת, המשלוח עדיין נשמר (ניתן
 * לטפל בידיים מאוחר יותר).
 *
 * @param {object} data - פרטי המשלוח
 * @param {number} createdByUserId - מי יוצר את המשלוח
 * @returns {Promise<object>} המשלוח שנוצר (כולל ID ו-reference_id)
 */
export async function createShipment(data, createdByUserId) {
  const {
    source_branch_id,
    target_branch_id,
    package_count,
    package_type = '02',
    notes = null,
  } = data;

  // === ולידציות ===
  if (!source_branch_id || !target_branch_id) {
    throw Object.assign(new Error('יש לבחור סניף שולח וסניף יעד'), { statusCode: 400 });
  }
  if (source_branch_id === target_branch_id) {
    throw Object.assign(new Error('לא ניתן לשלוח משלוח לאותו סניף'), { statusCode: 400 });
  }
  if (!Number.isInteger(package_count) || package_count <= 0) {
    throw Object.assign(new Error('כמות מארזים חייבת להיות מספר חיובי'), { statusCode: 400 });
  }
  if (!VALID_PACKAGE_TYPES.includes(package_type)) {
    throw Object.assign(new Error('סוג מארז לא תקין'), { statusCode: 400 });
  }

  // וידוא שהסניפים קיימים ופעילים
  const branchCheck = db.prepare(
    'SELECT COUNT(*) AS c FROM branches WHERE id IN (?, ?) AND is_active = 1'
  );
  const { c } = branchCheck.get(source_branch_id, target_branch_id);
  if (c < 2) {
    throw Object.assign(new Error('אחד הסניפים לא קיים או לא פעיל'), { statusCode: 400 });
  }

  // === יצירה בעסקה (transaction) ===
  // אם משהו מהשניים נכשל - הכל מתבטל
  const insertShipment = db.prepare(`
    INSERT INTO shipments
      (reference_id, source_branch_id, target_branch_id, package_count, package_type, notes, created_by, status)
    VALUES
      (@reference_id, @source_branch_id, @target_branch_id, @package_count, @package_type, @notes, @created_by, 'pending')
  `);

  const insertHistory = db.prepare(`
    INSERT INTO shipment_status_history (shipment_id, old_status, new_status, changed_by, notes)
    VALUES (?, NULL, 'pending', ?, 'יצירה ראשונית')
  `);

  const transaction = db.transaction(() => {
    // ניסיונות חוזרים אם ה-reference_id מתנגש (סבירות נמוכה)
    let referenceId;
    let lastError;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        referenceId = generateReferenceId();
        const result = insertShipment.run({
          reference_id: referenceId,
          source_branch_id,
          target_branch_id,
          package_count,
          package_type,
          notes,
          created_by: createdByUserId,
        });
        insertHistory.run(result.lastInsertRowid, createdByUserId);
        return result.lastInsertRowid;
      } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' && attempt < 4) {
          lastError = error;
          continue;
        }
        throw error;
      }
    }
    throw lastError || new Error('כשל ביצירת מזהה ייחודי למשלוח');
  });

  const newId = transaction();

  // קריאה לאוריין (mock או live לפי ENV) - אחרי שהמשלוח נשמר
  try {
    const sourceBranch = db.prepare('SELECT * FROM branches WHERE id = ?').get(source_branch_id);
    const targetBranch = db.prepare('SELECT * FROM branches WHERE id = ?').get(target_branch_id);
    const newShipment = getShipmentById(newId);

    const orianResult = await createTransportationOrder({
      shipment: newShipment,
      sourceBranch,
      targetBranch,
    });

    if (orianResult?.orian_order_id) {
      db.prepare(
        'UPDATE shipments SET orian_order_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(orianResult.orian_order_id, newId);

      // רושמים בהיסטוריה שאוריין קיבלה את ההזמנה
      db.prepare(
        `INSERT INTO shipment_status_history (shipment_id, old_status, new_status, changed_by, notes)
         VALUES (?, 'pending', 'pending', ?, ?)`
      ).run(
        newId,
        createdByUserId,
        `התקבל מזהה אוריין: ${orianResult.orian_order_id} (${orianResult.source})`
      );
    }
  } catch (orianError) {
    // אם אוריין נכשלה - לא מבטלים את המשלוח, אבל רושמים אזהרה
    console.error('⚠️  [Shipments] קריאה לאוריין נכשלה:', orianError.message);
    db.prepare(
      `INSERT INTO shipment_status_history (shipment_id, old_status, new_status, changed_by, notes)
       VALUES (?, 'pending', 'pending', ?, ?)`
    ).run(newId, createdByUserId, `כשל בקריאה לאוריין: ${orianError.message}`);
  }

  return getShipmentById(newId);
}

/**
 * מחזיר משלוח לפי ID, כולל פרטי הסניפים והמשתמש היוצר.
 */
export function getShipmentById(id) {
  return db
    .prepare(
      `SELECT
         s.*,
         src.code AS source_branch_code,
         src.branch_number AS source_branch_number,
         src.name AS source_branch_name,
         src.city AS source_branch_city,
         src.address AS source_branch_address,
         src.contact_name AS source_contact_name,
         src.contact_phone AS source_contact_phone,
         tgt.code AS target_branch_code,
         tgt.branch_number AS target_branch_number,
         tgt.name AS target_branch_name,
         tgt.city AS target_branch_city,
         tgt.address AS target_branch_address,
         tgt.contact_name AS target_contact_name,
         tgt.contact_phone AS target_contact_phone,
         creator.username  AS created_by_username,
         creator.full_name AS created_by_full_name,
         receiver.username  AS received_by_username,
         receiver.full_name AS received_by_full_name
       FROM shipments s
       JOIN branches src ON s.source_branch_id = src.id
       JOIN branches tgt ON s.target_branch_id = tgt.id
       JOIN users creator ON s.created_by = creator.id
       LEFT JOIN users receiver ON s.received_by = receiver.id
       WHERE s.id = ?`
    )
    .get(id);
}

/**
 * מחזיר את היסטוריית שינויי הסטטוס של משלוח, מהישן לחדש.
 */
export function getShipmentHistory(shipmentId) {
  return db
    .prepare(
      `SELECT
         h.id, h.old_status, h.new_status, h.notes, h.created_at,
         u.username  AS changed_by_username,
         u.full_name AS changed_by_full_name
       FROM shipment_status_history h
       LEFT JOIN users u ON h.changed_by = u.id
       WHERE h.shipment_id = ?
       ORDER BY h.created_at ASC, h.id ASC`
    )
    .all(shipmentId);
}

/**
 * מחזיר רשימת משלוחים, אופציונלית מסונן.
 *
 * @param {object} filters
 * @param {string} [filters.status]      - סינון לפי סטטוס
 * @param {number} [filters.branch_id]   - מציג משלוחים שהסניף שולח או מקבל
 * @param {string} [filters.search]      - חיפוש לפי reference_id (תת-מחרוזת)
 * @param {string} [filters.from]        - תאריך התחלה (YYYY-MM-DD) - נכלל
 * @param {string} [filters.to]          - תאריך סיום (YYYY-MM-DD) - לא נכלל
 * @param {number} [filters.limit=100]   - מקסימום תוצאות
 */
export function getShipments(filters = {}) {
  const { status, branch_id, search, from, to, limit = 100 } = filters;

  let sql = `
    SELECT
      s.id, s.reference_id, s.status, s.package_count, s.package_type,
      s.notes, s.received_count, s.created_at, s.updated_at, s.received_at,
      s.source_branch_id, s.target_branch_id, s.created_by,
      src.code AS source_branch_code, src.name AS source_branch_name,
      tgt.code AS target_branch_code, tgt.name AS target_branch_name,
      creator.full_name AS created_by_full_name
    FROM shipments s
    JOIN branches src ON s.source_branch_id = src.id
    JOIN branches tgt ON s.target_branch_id = tgt.id
    JOIN users creator ON s.created_by = creator.id
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    sql += ' AND s.status = ?';
    params.push(status);
  }
  if (branch_id) {
    sql += ' AND (s.source_branch_id = ? OR s.target_branch_id = ?)';
    params.push(branch_id, branch_id);
  }
  if (search && search.trim()) {
    sql += ' AND s.reference_id LIKE ?';
    params.push(`%${search.trim()}%`);
  }
  if (from) {
    sql += ' AND s.created_at >= ?';
    params.push(from);
  }
  if (to) {
    sql += ' AND s.created_at < ?';
    params.push(to);
  }

  sql += ' ORDER BY s.created_at DESC LIMIT ?';
  params.push(limit);

  return db.prepare(sql).all(...params);
}

/**
 * ביטול משלוח עם בדיקת הרשאות מובנית.
 *
 * - admin יכול לבטל בכל סטטוס "פתוח" (pending / sent)
 * - branch יכול לבטל רק משלוח שהוא יצר ועדיין בסטטוס pending
 * - שאר התפקידים לא יכולים לבטל
 *
 * @returns המשלוח אחרי הביטול
 */
export function cancelShipment(id, user, reason = null) {
  const shipment = db.prepare('SELECT * FROM shipments WHERE id = ?').get(id);

  if (!shipment) {
    throw Object.assign(new Error('המשלוח לא נמצא'), { statusCode: 404 });
  }

  // בדיקה שהמשלוח ניתן לביטול
  if (['received', 'mismatch', 'cancelled'].includes(shipment.status)) {
    throw Object.assign(
      new Error('לא ניתן לבטל משלוח שכבר התקבל או בוטל'),
      { statusCode: 400 }
    );
  }

  // בדיקת הרשאה לפי תפקיד
  if (user.role === 'admin') {
    // admin תמיד יכול
  } else if (user.role === 'branch') {
    // branch יכול לבטל רק משלוחים שהוא יצר ובסטטוס pending
    if (shipment.created_by !== user.id) {
      throw Object.assign(
        new Error('ניתן לבטל רק משלוחים שיצרת בעצמך'),
        { statusCode: 403 }
      );
    }
    if (shipment.status !== 'pending') {
      throw Object.assign(
        new Error('ניתן לבטל רק משלוחים שעוד לא יצאו (סטטוס "ממתין")'),
        { statusCode: 400 }
      );
    }
  } else {
    throw Object.assign(
      new Error('אין הרשאה לבטל משלוח'),
      { statusCode: 403 }
    );
  }

  const finalReason = reason?.trim() || 'בוטל';

  const transaction = db.transaction(() => {
    db.prepare(
      `UPDATE shipments
       SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(id);

    db.prepare(
      `INSERT INTO shipment_status_history (shipment_id, old_status, new_status, changed_by, notes)
       VALUES (?, ?, 'cancelled', ?, ?)`
    ).run(id, shipment.status, user.id, finalReason);
  });

  transaction();
  return getShipmentById(id);
}

/**
 * שינוי סטטוס משלוח (כולל רישום בהיסטוריה).
 */
export function updateStatus(id, newStatus, userId, notes = null) {
  if (!VALID_STATUSES.includes(newStatus)) {
    throw Object.assign(new Error('סטטוס לא תקין'), { statusCode: 400 });
  }

  const current = db.prepare('SELECT status FROM shipments WHERE id = ?').get(id);
  if (!current) {
    throw Object.assign(new Error('המשלוח לא נמצא'), { statusCode: 404 });
  }
  if (current.status === newStatus) {
    return getShipmentById(id); // אין שינוי
  }

  const transaction = db.transaction(() => {
    db.prepare(
      `UPDATE shipments
       SET status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(newStatus, id);

    db.prepare(
      `INSERT INTO shipment_status_history (shipment_id, old_status, new_status, changed_by, notes)
       VALUES (?, ?, ?, ?, ?)`
    ).run(id, current.status, newStatus, userId, notes);
  });

  transaction();
  return getShipmentById(id);
}

/**
 * אישור קבלה - שינוי סטטוס ל-received או mismatch לפי ההתאמה
 */
export function confirmReceipt(id, receivedCount, userId, notes = null) {
  const shipment = db.prepare('SELECT * FROM shipments WHERE id = ?').get(id);
  if (!shipment) {
    throw Object.assign(new Error('המשלוח לא נמצא'), { statusCode: 404 });
  }

  if (!Number.isInteger(receivedCount) || receivedCount < 0) {
    throw Object.assign(new Error('כמות שהתקבלה חייבת להיות מספר חיובי או 0'), { statusCode: 400 });
  }

  const newStatus = receivedCount === shipment.package_count ? 'received' : 'mismatch';
  const historyNote = newStatus === 'mismatch'
    ? `אי-התאמה: נשלחו ${shipment.package_count}, התקבלו ${receivedCount}. ${notes || ''}`.trim()
    : notes || 'הכמויות תואמות';

  const transaction = db.transaction(() => {
    db.prepare(
      `UPDATE shipments
       SET status = ?, received_count = ?, received_by = ?, received_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(newStatus, receivedCount, userId, id);

    db.prepare(
      `INSERT INTO shipment_status_history (shipment_id, old_status, new_status, changed_by, notes)
       VALUES (?, ?, ?, ?, ?)`
    ).run(id, shipment.status, newStatus, userId, historyNote);
  });

  transaction();
  return getShipmentById(id);
}
