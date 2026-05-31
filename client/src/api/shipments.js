// פונקציות API למשלוחים

import apiClient from './client.js';

/**
 * יצירת משלוח חדש
 * @param {object} payload - { source_branch_id?, target_branch_id, package_count, package_type?, notes? }
 *                           source_branch_id מתעלמים אם המשתמש הוא branch/warehouse - השרת מאלץ
 */
export async function createShipment(payload) {
  const { data } = await apiClient.post('/shipments', payload);
  return data.shipment;
}

/**
 * מחזיר רשימת משלוחים (עם סינון אופציונלי)
 * @param {object} filters - { status?, branch_id? }
 */
export async function listShipments(filters = {}) {
  const { data } = await apiClient.get('/shipments', { params: filters });
  return data.shipments;
}

/**
 * פרטי משלוח בודד
 */
export async function getShipment(id) {
  const { data } = await apiClient.get(`/shipments/${id}`);
  return data.shipment;
}

/**
 * היסטוריית שינויי סטטוס של משלוח (מהישן לחדש)
 */
export async function getShipmentHistory(id) {
  const { data } = await apiClient.get(`/shipments/${id}/history`);
  return data.history;
}

/**
 * שינוי סטטוס ידני (admin/warehouse)
 */
export async function updateShipmentStatus(id, status, notes) {
  const { data } = await apiClient.patch(`/shipments/${id}/status`, { status, notes });
  return data.shipment;
}

/**
 * אישור קבלה עם בדיקת התאמת כמויות
 */
export async function confirmShipmentReceipt(id, receivedCount, notes) {
  const { data } = await apiClient.post(`/shipments/${id}/receive`, {
    received_count: receivedCount,
    notes,
  });
  return data.shipment;
}

/**
 * ביטול משלוח. השרת בודק הרשאות לפי תפקיד.
 */
export async function cancelShipment(id, reason) {
  const { data } = await apiClient.post(`/shipments/${id}/cancel`, { reason });
  return data.shipment;
}

/**
 * סימון משלוח כנשלח (פעם אחת - רק אם status === 'pending').
 * @param {number} id
 * @param {'print' | 'mark_sent'} action - איך לרשום בהיסטוריה
 */
export async function markShipmentAsSent(id, action = 'mark_sent') {
  const { data } = await apiClient.post(`/shipments/${id}/mark-sent`, { action });
  return data; // { shipment, alreadySent }
}

/**
 * סניף מסמן שהמשלוח לא התקבל (אחרי 7+ ימים מ-sent).
 */
export async function markShipmentNotReceived(id, notes) {
  const { data } = await apiClient.post(`/shipments/${id}/mark-not-received`, { notes });
  return data.shipment;
}

/**
 * האם ניתן להדפיס מדבקה למשלוח?
 * (לא ניתן לבוטלים)
 */
/**
 * מושך מדבקת שילוח מאוריין — מחזיר data URL של PDF
 * עובד רק במצב live. במצב mock מחזיר שגיאה עם error.isMockMode=true
 */
export async function getShipmentLabel(id) {
  const { data } = await apiClient.get(`/shipments/${id}/label`);
  return data; // { label_pdf, label_base64, reference_id }
}

export function canPrintLabel(shipment) {
  if (!shipment) return false;
  return !['cancelled', 'not_received'].includes(shipment.status);
}

/**
 * האם המשתמש יכול לבטל את המשלוח (לפי הלוגיקה של ה-Backend).
 * שימושי להחלטה אם להציג כפתור ביטול ב-UI.
 */
export function canCancelShipment(shipment, user) {
  // אי אפשר לבטל אם המשלוח כבר התקבל/בוטל
  if (['received', 'mismatch', 'cancelled'].includes(shipment.status)) {
    return false;
  }
  // admin תמיד יכול לבטל
  if (user.role === 'admin') return true;
  // branch יכול לבטל רק משלוחים שהוא יצר בסטטוס pending
  if (user.role === 'branch') {
    return shipment.status === 'pending' && shipment.created_by === user.id;
  }
  return false;
}

// תוויות עבריות לסטטוסים
export const STATUS_LABELS = {
  pending: 'ממתין',
  sent: 'נשלח',
  received: 'התקבל',
  mismatch: 'אי-התאמה',
  cancelled: 'בוטל',
  not_received: 'לא התקבל',
};

// מחלקות Tailwind לכל סטטוס (צבע רקע)
export const STATUS_CLASSES = {
  pending: 'bg-gray-200 text-gray-800',
  sent: 'bg-status-sent text-white',
  received: 'bg-status-received text-white',
  mismatch: 'bg-status-mismatch text-white',
  cancelled: 'bg-status-error text-white',     // אדום (במקום אפור)
  not_received: 'bg-red-700 text-white',       // אדום כהה
};

// סוגי מארזים לפי מסמכי אוריין
export const PACKAGE_TYPES = [
  { value: '01', label: 'מעטפה' },
  { value: '02', label: 'חבילה' },
  { value: '03', label: 'חבילה כבדה' },
  { value: '05', label: 'משטח' },
];
