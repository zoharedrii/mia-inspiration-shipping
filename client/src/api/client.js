// HTTP Client של ה-Frontend לשרת שלנו
//
// כל הקריאות לשרת עוברות דרכו - מקום מרכזי להגדיר baseURL,
// timeout, ו-interceptors.

import axios from 'axios';
import { TOKEN_KEY } from '../context/AuthContext.jsx';

// /api מנותב דרך Vite proxy ל-http://localhost:3001 בזמן פיתוח
const apiClient = axios.create({
  baseURL: '/api',
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// === Interceptor לבקשות יוצאות ===
// מוסיף אוטומטית "Authorization: Bearer <token>" אם יש token שמור
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// === Interceptor לתגובות נכנסות ===
// אם השרת מחזיר 401, סימן שהtoken פג תוקף - מנקים ומפנים ל-/login
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // מסירים את ה-token הפגוע
      localStorage.removeItem(TOKEN_KEY);
      // אם זה לא היה כבר נסיון login, מפנים ל-login
      const isLoginRequest = error.config?.url?.includes('/auth/login');
      if (!isLoginRequest && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
