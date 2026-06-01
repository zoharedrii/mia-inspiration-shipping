// שירות משלוחים - הלוגיקה העסקית של ניהול משלוחים (D1).
//
// כל הקוד שמתעסק עם טבלת shipments עובר דרך הקובץ הזה: יצירה, שאילתות,
// שינוי סטטוס, ורישום אוטומטי בהיסטוריה.
//
// הערה על "עסקאות": ב-better-sqlite3 השתמשנו ב-db.transaction() כדי לעטוף
// כמה פעולות. D1 לא תומך בעסקאות אינטראקטיביות, אז כאן הפעולות רצות
// ברצף (await אחרי await). לפרויקט בהיקף הזה זה מספיק ובטוח.

import { createTransportationOrder } from './orian/transportation.js';
import { httpError } from '../lib/http.js';

const VALID_STATUSES = ['pending', 'sent', 'received', 'mismatch', 'cancelled', 'not_received'];
const VALID_PACKAGE_TYPES = ['01', '02', '03', '05']; // לפי מסמכי אוריין

/**
 * מחולל מזהה משלוח ייחודי בפורמט SHP-YYYYMMDD-XXXX
 */
function generateReferenceId() {
  const date = new Date();
  const yyyymmdd = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `SHP-${yyyymmdd}-${random}`;
}

/**
 * יצירת משלוח חדש ב-DB. הסטטוס ההתחלתי הוא 'pending'.
 * אחרי השמירה, השרת קורא לאוריין (mock או live) ושומר את מזהה ההזמנה.
 * אם אוריין נכשלת - המשלוח עדיין נשמר.
 *
 * @param {D1Database} db
 * @param {object} env - משתני סביבה (עבור אוריין)
 * @param {object} data - פרטי המשלוח
 * @param {number} createdByUserId
 * @returns {Promise<object>} המשלוח שנוצר
 */
export async function createShipment(db, env, data, createdByUserId) {
  const {
    source_branch_id,
    target_branch_id,
    package_count,
    package_type = '02',
    notes = null,
  } = data;

  // === ולידציות ===
  if (!source_branch_id || !target_branch_id) {
    throw httpError('יש לבחור סניף שולח וסניף יעד', 400);
  }
  if (source_branch_id === target_branch_id) {
    throw httpError('לא ניתן לשלוח משלוח לאותו סניף', 400);
  }
  if (!Number.isInteger(package_count) || package_count <= 0) {
    throw httpError('כמות מארזים חייבת להיות מספר חיובי', 400);
  }
  if (!VALID_PACKAGE_TYPES.includes(package_type)) {
    throw httpError('סוג מארז לא תקין', 400);
  }

  // וידוא שהסניפים קיימים ופעילים
  const branchCheck = await db
    .prepare('SELECT COUNT(*) AS c FROM branches WHERE id IN (?, ?) AND is_active = 1')
    .bind(source_branch_id, target_branch_id)
    .first();
  if (branchCheck.c < 2) {
    throw httpError('אחד הסניפים לא קיים או לא פעיל', 400);
  }

  // === יצירה עם ניסיונות חוזרים אם ה-reference_id מתנגש (סבירות נמוכה) ===
  let newId;
  let lastError;
  for (let attempt = 0; attempt < 5; attempt++) {
    const referenceId = generateReferenceId();
    try {
      const result = await db
        .prepare(
          `INSERT INTO shipments
             (reference_id, source_branch_id, target_branch_id, package_count, package_type, notes, created_by, status)
           VALUES
             (?, ?, ?, ?, ?, ?, ?, 'pending')`
        )
        .bind(referenceId, source_branch_id, target_branch_id, package_count, package_type, notes, createdByUserId)
        .run();
      newId = result.meta.last_row_id;
      await db
        .prepare(
          `INSERT INTO shipment_status_history (shipment_id, old_status, new_status, changed_by, notes)
           VALUES (?, NULL, 'pending', ?, 'יצירה ראשונית')`
        )
        .bind(newId, createdByUserId)
        .run();
      break;
    } catch (error) {
      // D1 זורק שגיאה עם "UNIQUE" כשיש התנגשות במפתח ייחודי
      if (String(error.message).includes('UNIQUE') && attempt < 4) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }
  if (!newId) {
    throw lastError || new Error('כשל ביצירת מזהה ייחודי למשלוח');
  }

  // קריאה לאוריין (mock או live) - אחרי שהמשלוח נשמר
  try {
    const sourceBranch = await db.prepare('SELECT * FROM branches WHERE id = ?').bind(source_branch_id).first();
    const targetBranch = await db.prepare('SELECT * FROM branches WHERE id = ?').bind(target_branch_id).first();
    const newShipment = await getShipmentById(db, newId);

    console.log(`🚀 [Shipments] קורא לאוריין עבור משלוח ${newShipment.reference_id}`);
    console.log(`🚀 [Shipments] מקור: ${sourceBranch?.name} (id=${source_branch_id}) | יעד: ${targetBranch?.name} (id=${target_branch_id})`);
    console.log(`🚀 [Shipments] ORIAN_MODE=${env.ORIAN_MODE} | ORIAN_BASE_URL=${env.ORIAN_BASE_URL}`);
    console.log(`🚀 [Shipments] CONSIGNEE מוגדר: ${Boolean(env.ORIAN_CONSIGNEE)} | USERNAME מוגדר: ${Boolean(env.ORIAN_USERNAME)}`);

    const orianResult = await createTransportationOrder(env, {
      shipment: newShipment,
      sourceBranch,
      targetBranch,
    });

    console.log(`✅ [Shipments] אוריין הצליח: orian_order_id=${orianResult?.orian_order_id}`);

    if (orianResult?.orian_order_id) {
      // שומרים את מזהי החבילות כמחרוזת מופרדת בפסיקים (לשליפת סטטוס בהמשך)
      const packageIds = Array.isArray(orianResult.package_ids)
        ? orianResult.package_ids.join(',')
        : null;

      await db
        .prepare('UPDATE shipments SET orian_order_id = ?, package_ids = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .bind(orianResult.orian_order_id, packageIds, newId)
        .run();

      await db
        .prepare(
          `INSERT INTO shipment_status_history (shipment_id, old_status, new_status, changed_by, notes)
           VALUES (?, 'pending', 'pending', ?, ?)`
        )
        .bind(newId, createdByUserId, `התקבל מזהה אוריין: ${orianResult.orian_order_id} (${orianResult.source})`)
        .run();
    }
  } catch (orianError) {
    console.error('❌ [Shipments] קריאה לאוריין נכשלה:', orianError.message);
    // שומרים את השגיאה המלאה בהיסטוריה כדי שאפשר לאבחן מה קרה
    const errorNote = `כשל בקריאה לאוריין: ${orianError.message}`;
    await db
      .prepare(
        `INSERT INTO shipment_status_history (shipment_id, old_status, new_status, changed_by, notes)
         VALUES (?, 'pending', 'pending', ?, ?)`
      )
      .bind(newId, createdByUserId, errorNote)
      .run();
  }

  return getShipmentById(db, newId);
}

/**
 * מחזיר משלוח לפי ID, כולל פרטי הסניפים והמשתמשים.
 */
export async function getShipmentById(db, id) {
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
    .bind(id)
    .first();
}

/**
 * מחזיר את היסטוריית שינויי הסטטוס של משלוח, מהישן לחדש.
 */
export async function getShipmentHistory(db, shipmentId) {
  const { results } = await db
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
    .bind(shipmentId)
    .all();
  return results;
}

/**
 * מחזיר רשימת משלוחים, אופציונלית מסונן.
 *
 * @param {object} filters - { status?, branch_id?, search?, from?, to?, limit=100 }
 */
export async function getShipments(db, filters = {}) {
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

  const { results } = await db.prepare(sql).bind(...params).all();
  return results;
}

/**
 * ביטול משלוח עם בדיקת הרשאות מובנית.
 * - admin יכול לבטל בכל סטטוס "פתוח" (pending / sent)
 * - branch יכול לבטל רק משלוח שהוא יצר ועדיין בסטטוס pending
 */
export async function cancelShipment(db, id, user, reason = null) {
  const shipment = await db.prepare('SELECT * FROM shipments WHERE id = ?').bind(id).first();

  if (!shipment) {
    throw httpError('המשלוח לא נמצא', 404);
  }

  if (['received', 'mismatch', 'cancelled'].includes(shipment.status)) {
    throw httpError('לא ניתן לבטל משלוח שכבר התקבל או בוטל', 400);
  }

  // בדיקת הרשאה לפי תפקיד
  if (user.role === 'admin') {
    // admin תמיד יכול
  } else if (user.role === 'branch') {
    if (shipment.created_by !== user.id) {
      throw httpError('ניתן לבטל רק משלוחים שיצרת בעצמך', 403);
    }
    if (shipment.status !== 'pending') {
      throw httpError('ניתן לבטל רק משלוחים שעוד לא יצאו (סטטוס "ממתין")', 400);
    }
  } else {
    throw httpError('אין הרשאה לבטל משלוח', 403);
  }

  const finalReason = reason?.trim() || 'בוטל';

  await db
    .prepare(`UPDATE shipments SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(id)
    .run();

  await db
    .prepare(
      `INSERT INTO shipment_status_history (shipment_id, old_status, new_status, changed_by, notes)
       VALUES (?, ?, 'cancelled', ?, ?)`
    )
    .bind(id, shipment.status, user.id, finalReason)
    .run();

  return getShipmentById(db, id);
}

/**
 * סימון משלוח כ"נשלח" (מ-pending → sent). רק פעם אחת.
 * @returns {object} { shipment, alreadySent }
 */
export async function markAsSent(db, id, userId, action = 'mark_sent') {
  const shipment = await db.prepare('SELECT * FROM shipments WHERE id = ?').bind(id).first();
  if (!shipment) {
    throw httpError('המשלוח לא נמצא', 404);
  }

  // אם כבר נשלח/בוטל/הסתיים - לא משנים שום דבר (לא שגיאה)
  if (shipment.status !== 'pending') {
    return { shipment: await getShipmentById(db, id), alreadySent: true };
  }

  const note = action === 'print' ? 'המדבקה הודפסה ונשלחה' : 'סומן כנשלח על ידי הסניף';

  await db
    .prepare(`UPDATE shipments SET status = 'sent', updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(id)
    .run();

  await db
    .prepare(
      `INSERT INTO shipment_status_history (shipment_id, old_status, new_status, changed_by, notes)
       VALUES (?, 'pending', 'sent', ?, ?)`
    )
    .bind(id, userId, note)
    .run();

  return { shipment: await getShipmentById(db, id), alreadySent: false };
}

/**
 * סימון משלוח כ"לא התקבל" - על ידי סניף היעד אחרי 7+ ימים מ-sent.
 */
export async function markNotReceived(db, id, userId, notes = null) {
  const shipment = await db.prepare('SELECT * FROM shipments WHERE id = ?').bind(id).first();
  if (!shipment) {
    throw httpError('המשלוח לא נמצא', 404);
  }
  if (shipment.status !== 'sent') {
    throw httpError('ניתן לסמן "לא התקבל" רק למשלוחים בסטטוס "נשלח"', 400);
  }

  // בדיקה שעברו לפחות 7 ימים מאז שעודכן ל-sent
  const updatedAt = new Date(shipment.updated_at.replace(' ', 'T') + 'Z');
  const daysSince = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince < 7) {
    throw httpError(
      `ניתן לסמן "לא התקבל" רק אחרי 7 ימים מהשליחה (כרגע עברו ${Math.floor(daysSince)} ימים)`,
      400
    );
  }

  const note = notes?.trim() || 'הסניף סימן שהמשלוח לא התקבל';

  await db
    .prepare(`UPDATE shipments SET status = 'not_received', updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(id)
    .run();

  await db
    .prepare(
      `INSERT INTO shipment_status_history (shipment_id, old_status, new_status, changed_by, notes)
       VALUES (?, 'sent', 'not_received', ?, ?)`
    )
    .bind(id, userId, note)
    .run();

  return getShipmentById(db, id);
}

/**
 * שינוי סטטוס משלוח (כולל רישום בהיסטוריה).
 */
export async function updateStatus(db, id, newStatus, userId, notes = null) {
  if (!VALID_STATUSES.includes(newStatus)) {
    throw httpError('סטטוס לא תקין', 400);
  }

  const current = await db.prepare('SELECT status FROM shipments WHERE id = ?').bind(id).first();
  if (!current) {
    throw httpError('המשלוח לא נמצא', 404);
  }
  if (current.status === newStatus) {
    return getShipmentById(db, id); // אין שינוי
  }

  await db
    .prepare(`UPDATE shipments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(newStatus, id)
    .run();

  await db
    .prepare(
      `INSERT INTO shipment_status_history (shipment_id, old_status, new_status, changed_by, notes)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(id, current.status, newStatus, userId, notes)
    .run();

  return getShipmentById(db, id);
}

/**
 * אישור קבלה - שינוי סטטוס ל-received או mismatch לפי ההתאמה.
 */
export async function confirmReceipt(db, id, receivedCount, userId, notes = null) {
  const shipment = await db.prepare('SELECT * FROM shipments WHERE id = ?').bind(id).first();
  if (!shipment) {
    throw httpError('המשלוח לא נמצא', 404);
  }

  if (!Number.isInteger(receivedCount) || receivedCount < 0) {
    throw httpError('כמות שהתקבלה חייבת להיות מספר חיובי או 0', 400);
  }

  const newStatus = receivedCount === shipment.package_count ? 'received' : 'mismatch';
  const historyNote =
    newStatus === 'mismatch'
      ? `אי-התאמה: נשלחו ${shipment.package_count}, התקבלו ${receivedCount}. ${notes || ''}`.trim()
      : notes || 'הכמויות תואמות';

  await db
    .prepare(
      `UPDATE shipments
       SET status = ?, received_count = ?, received_by = ?, received_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
    .bind(newStatus, receivedCount, userId, id)
    .run();

  await db
    .prepare(
      `INSERT INTO shipment_status_history (shipment_id, old_status, new_status, changed_by, notes)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(id, shipment.status, newStatus, userId, historyNote)
    .run();

  return getShipmentById(db, id);
}
