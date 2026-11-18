// פונקציות API לסריקת חבילות לאיסוף מסניף

import apiClient from './client.js';

/**
 * שולח סריקה של חבילה ללקוחה.
 * מחזיר { ok, code, message, order_number, customer_name?, correct_branch? }
 */
export async function scanPickupOrder(orderNumber) {
  const { data } = await apiClient.post('/pickup/scan', { order_number: orderNumber });
  return data;
}
