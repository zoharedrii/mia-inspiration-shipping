// HTTP Client לתקשורת עם API של חברת אוריין
//
// משמש כבסיס לכל הקריאות למערכת אוריין. כולל:
// - הגדרת כתובת בסיס מ-.env (סביבת Test או Production)
// - timeout סביר
// - headers ברירת מחדל

import axios from 'axios';

const baseURL = process.env.ORIAN_BASE_URL;

if (!baseURL) {
  throw new Error(
    'חסר משתנה הסביבה ORIAN_BASE_URL — בדקי את קובץ .env'
  );
}

const orianClient = axios.create({
  baseURL,
  timeout: 30_000, // 30 שניות - אוריין יכול להיות איטי לפעמים
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
});

// Interceptor שמדפיס כל קריאה ל-console (עוזר בפיתוח)
orianClient.interceptors.request.use((config) => {
  console.log(`📤 [Orian] ${config.method?.toUpperCase()} ${config.url}`);
  return config;
});

orianClient.interceptors.response.use(
  (response) => {
    console.log(`📥 [Orian] ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    const status = error.response?.status || 'NETWORK';
    const url = error.config?.url || '?';
    console.error(`❌ [Orian] ${status} ${url} - ${error.message}`);
    return Promise.reject(error);
  }
);

export default orianClient;
