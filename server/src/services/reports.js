// שירות דוחות - אגרגציות ושאילתות סטטיסטיות על המשלוחים
//
// כל פונקציה מחזירה אובייקט עם:
// - summary (סיכומים אגרגטיביים)
// - שורות הפירוט (שמהן הסיכום נגזר)

import db from '../db/index.js';

/**
 * דוח משלוחים חודשי - כל המשלוחים שנוצרו בחודש מסוים
 *
 * @param {number} year - שנה (לדוגמה 2026)
 * @param {number} month - חודש 1-12
 */
export function getMonthlyReport(year, month) {
  // SQLite שומר תאריכים בפורמט 'YYYY-MM-DD HH:MM:SS' - מספיק להשוות תחילית
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;

  const shipments = db
    .prepare(
      `SELECT s.id, s.reference_id, s.status, s.package_count, s.received_count,
              s.package_type, s.created_at, s.received_at,
              src.code AS source_code, src.name AS source_name,
              tgt.code AS target_code, tgt.name AS target_name,
              c.full_name AS created_by_name
       FROM shipments s
       JOIN branches src ON s.source_branch_id = src.id
       JOIN branches tgt ON s.target_branch_id = tgt.id
       JOIN users c ON s.created_by = c.id
       WHERE substr(s.created_at, 1, 7) = ?
       ORDER BY s.created_at DESC`
    )
    .all(monthPrefix);

  // חישוב זמן ממוצע להפצה (created_at → received_at) במשלוחים שהתקבלו
  const receivedShips = shipments.filter((s) => s.received_at && (s.status === 'received' || s.status === 'mismatch'));
  const totalDays = receivedShips.reduce((sum, s) => {
    const created = new Date(s.created_at.replace(' ', 'T') + 'Z');
    const received = new Date(s.received_at.replace(' ', 'T') + 'Z');
    return sum + (received - created) / (1000 * 60 * 60 * 24);
  }, 0);
  const avgDeliveryDays = receivedShips.length > 0
    ? Number((totalDays / receivedShips.length).toFixed(1))
    : null;

  const summary = {
    total: shipments.length,
    pending: shipments.filter((s) => s.status === 'pending').length,
    sent: shipments.filter((s) => s.status === 'sent').length,
    received: shipments.filter((s) => s.status === 'received').length,
    mismatch: shipments.filter((s) => s.status === 'mismatch').length,
    cancelled: shipments.filter((s) => s.status === 'cancelled').length,
    not_received: shipments.filter((s) => s.status === 'not_received').length,
    total_packages: shipments.reduce((sum, s) => sum + s.package_count, 0),
    received_packages: shipments
      .filter((s) => s.received_count != null)
      .reduce((sum, s) => sum + s.received_count, 0),
    avg_delivery_days: avgDeliveryDays,
  };

  return { period: monthPrefix, summary, shipments };
}

/**
 * דוח אי-התאמות - משלוחים בסטטוס mismatch בטווח תאריכים
 *
 * @param {string} from - תאריך התחלה YYYY-MM-DD
 * @param {string} to - תאריך סיום YYYY-MM-DD (לא כולל)
 */
export function getMismatchesReport(from, to) {
  const shipments = db
    .prepare(
      `SELECT s.id, s.reference_id, s.package_count, s.received_count,
              s.notes, s.created_at, s.received_at,
              src.name AS source_name, tgt.name AS target_name,
              creator.full_name AS created_by_name,
              receiver.full_name AS received_by_name
       FROM shipments s
       JOIN branches src ON s.source_branch_id = src.id
       JOIN branches tgt ON s.target_branch_id = tgt.id
       JOIN users creator ON s.created_by = creator.id
       LEFT JOIN users receiver ON s.received_by = receiver.id
       WHERE s.status = 'mismatch'
         AND s.received_at >= ? AND s.received_at < ?
       ORDER BY s.received_at DESC`
    )
    .all(from, to);

  // הפרשים (יכול להיות חיובי = עודף, או שלילי = חסר)
  const enriched = shipments.map((s) => ({
    ...s,
    diff: (s.received_count ?? 0) - s.package_count,
  }));

  const summary = {
    total: enriched.length,
    total_shortage: enriched.filter((s) => s.diff < 0).reduce((sum, s) => sum + s.diff, 0),
    total_excess: enriched.filter((s) => s.diff > 0).reduce((sum, s) => sum + s.diff, 0),
  };

  return { period: { from, to }, summary, shipments: enriched };
}

/**
 * דוח משלוחים פעילים - משלוחים שעוד לא הסתיימו (pending / sent)
 * עם חישוב ותק (כמה ימים עברו מאז היצירה)
 */
export function getActiveShipmentsReport() {
  const shipments = db
    .prepare(
      `SELECT s.id, s.reference_id, s.status, s.package_count,
              s.created_at, s.updated_at,
              src.name AS source_name, tgt.name AS target_name,
              creator.full_name AS created_by_name,
              CAST((julianday('now') - julianday(s.created_at)) AS INTEGER) AS days_since_creation
       FROM shipments s
       JOIN branches src ON s.source_branch_id = src.id
       JOIN branches tgt ON s.target_branch_id = tgt.id
       JOIN users creator ON s.created_by = creator.id
       WHERE s.status IN ('pending', 'sent')
       ORDER BY s.created_at ASC`
    )
    .all();

  const summary = {
    total: shipments.length,
    pending_count: shipments.filter((s) => s.status === 'pending').length,
    sent_count: shipments.filter((s) => s.status === 'sent').length,
    // משלוחים "ישנים" - יותר מ-3 ימים בלי התקדמות לסיום
    overdue_count: shipments.filter((s) => s.days_since_creation >= 3).length,
  };

  return { summary, shipments };
}

/**
 * דוח פעילות סניף - משלוחים שהסניף שלח/קיבל בטווח
 */
export function getBranchActivityReport(branchId, from, to) {
  const branch = db.prepare('SELECT * FROM branches WHERE id = ?').get(branchId);
  if (!branch) {
    throw Object.assign(new Error('הסניף לא נמצא'), { statusCode: 404 });
  }

  // משלוחים שיצאו מהסניף
  const outgoing = db
    .prepare(
      `SELECT s.id, s.reference_id, s.status, s.package_count, s.received_count,
              s.created_at,
              tgt.name AS target_name
       FROM shipments s
       JOIN branches tgt ON s.target_branch_id = tgt.id
       WHERE s.source_branch_id = ?
         AND s.created_at >= ? AND s.created_at < ?
       ORDER BY s.created_at DESC`
    )
    .all(branchId, from, to);

  // משלוחים שהגיעו לסניף
  const incoming = db
    .prepare(
      `SELECT s.id, s.reference_id, s.status, s.package_count, s.received_count,
              s.created_at, s.received_at,
              src.name AS source_name
       FROM shipments s
       JOIN branches src ON s.source_branch_id = src.id
       WHERE s.target_branch_id = ?
         AND s.created_at >= ? AND s.created_at < ?
       ORDER BY s.created_at DESC`
    )
    .all(branchId, from, to);

  return {
    branch,
    period: { from, to },
    outgoing: {
      total: outgoing.length,
      total_packages: outgoing.reduce((s, x) => s + x.package_count, 0),
      shipments: outgoing,
    },
    incoming: {
      total: incoming.length,
      total_packages: incoming.reduce((s, x) => s + x.package_count, 0),
      mismatches: incoming.filter((s) => s.status === 'mismatch').length,
      shipments: incoming,
    },
  };
}
