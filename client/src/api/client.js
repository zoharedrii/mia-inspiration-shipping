// HTTP Client של ה-Frontend לשרת שלנו
//
// כל הקריאות לשרת עוברות דרכו - מקום מרכזי להגדיר baseURL,
// timeout, ו-interceptors (למשל הוספת token לכל בקשה בעתיד).

import axios from 'axios';

// /api מנותב דרך Vite proxy ל-http://localhost:3001 בזמן פיתוח
// ובפרודקשן ל-/api על אותו דומיין כמו ה-Frontend
const apiClient = axios.create({
  baseURL: '/api',
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default apiClient;
