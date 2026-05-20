// פונקציות API לדוחות

import apiClient from './client.js';

/**
 * דוח חודשי
 * @param {number} year - לדוגמה 2026
 * @param {number} month - 1-12
 */
export async function getMonthlyReport(year, month) {
  const { data } = await apiClient.get('/reports/monthly', { params: { year, month } });
  return data;
}

/**
 * דוח אי-התאמות בטווח תאריכים
 * @param {string} from - YYYY-MM-DD
 * @param {string} to - YYYY-MM-DD (לא כולל)
 */
export async function getMismatchesReport(from, to) {
  const { data } = await apiClient.get('/reports/mismatches', { params: { from, to } });
  return data;
}

/**
 * דוח משלוחים פעילים (לא הסתיימו)
 */
export async function getActiveShipmentsReport() {
  const { data } = await apiClient.get('/reports/active');
  return data;
}

/**
 * דוח פעילות סניף
 */
export async function getBranchActivityReport(branchId, from, to) {
  const { data } = await apiClient.get(`/reports/branch/${branchId}`, { params: { from, to } });
  return data;
}
