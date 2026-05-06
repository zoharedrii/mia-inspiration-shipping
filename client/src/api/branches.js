// פונקציות API לסניפים

import apiClient from './client.js';

/**
 * מחזיר רשימת כל הסניפים הפעילים
 */
export async function listBranches() {
  const { data } = await apiClient.get('/branches');
  return data.branches;
}
