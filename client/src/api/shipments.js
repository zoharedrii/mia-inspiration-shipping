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

// תוויות עבריות לסטטוסים
export const STATUS_LABELS = {
  pending: 'ממתין',
  sent: 'נשלח',
  received: 'התקבל',
  mismatch: 'אי-התאמה',
  cancelled: 'בוטל',
};

// מחלקות Tailwind לכל סטטוס (צבע רקע)
export const STATUS_CLASSES = {
  pending: 'bg-gray-200 text-gray-800',
  sent: 'bg-status-sent text-white',
  received: 'bg-status-received text-white',
  mismatch: 'bg-status-mismatch text-white',
  cancelled: 'bg-gray-400 text-white',
};

// סוגי מארזים לפי מסמכי אוריין
export const PACKAGE_TYPES = [
  { value: '01', label: 'מעטפה' },
  { value: '02', label: 'חבילה' },
  { value: '03', label: 'חבילה כבדה' },
  { value: '05', label: 'משטח' },
];
