// פונקציות API לניהול משתמשים (admin בלבד)

import apiClient from './client.js';

export async function listUsers() {
  const { data } = await apiClient.get('/users');
  return data.users;
}

export async function createUser(payload) {
  const { data } = await apiClient.post('/users', payload);
  return data.user;
}

export async function updateUser(id, payload) {
  const { data } = await apiClient.patch(`/users/${id}`, payload);
  return data.user;
}

export async function setUserActive(id, isActive) {
  const { data } = await apiClient.patch(`/users/${id}/active`, { is_active: isActive });
  return data.user;
}

export async function resetUserPassword(id, password) {
  const { data } = await apiClient.post(`/users/${id}/reset-password`, { password });
  return data;
}

export const ROLE_OPTIONS = [
  { value: 'admin',      label: 'מנהל מערכת' },
  { value: 'warehouse',  label: 'מנהל מחסן' },
  { value: 'branch',     label: 'עובד סניף' },
  { value: 'accounting', label: 'הנהלת חשבונות' },
];

export const ROLE_LABELS = Object.fromEntries(
  ROLE_OPTIONS.map((r) => [r.value, r.label])
);
