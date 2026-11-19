// פונקציות API להזמנות איסוף (לקוחות שאוספות מסניף)

import apiClient from './client.js';

/**
 * הזמנות בדרך לסניף + ממתינות ללקוחה
 */
export async function listPickupOrders(archive) {
  const { data } = await apiClient.get('/pickup-orders', { params: archive ? { archive: 1 } : {} });
  return data.orders;
}

/**
 * "ההזמנה הגיעה לסניף" - הלקוחה מקבלת SMS עם לינק לאישור איסוף.
 * pickupBranchId נדרש רק למנהלת (סניף - השרת יודע לבד).
 */
export async function receivePickupOrder(orderNumber, pickupBranchId) {
  const { data } = await apiClient.post(`/pickup-orders/${encodeURIComponent(orderNumber)}/receive`, {
    pickup_branch_id: pickupBranchId,
  });
  return data;
}

/**
 * שליחת ה-SMS ללקוחה שוב (אחרי שהשליחה הראשונה נכשלה)
 */
export async function resendPickupSms(orderNumber) {
  const { data } = await apiClient.post(`/pickup-orders/${encodeURIComponent(orderNumber)}/resend-sms`);
  return data;
}

/**
 * "נמסרה ללקוחה" - כשהלקוחה אספה ולא לחצה על הלינק
 */
export async function handoverPickupOrder(orderNumber, pickupBranchId) {
  const { data } = await apiClient.post(`/pickup-orders/${encodeURIComponent(orderNumber)}/handover`, {
    pickup_branch_id: pickupBranchId,
  });
  return data;
}
