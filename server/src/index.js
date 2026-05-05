// נקודת הכניסה של שרת ה-Backend
// כאן השרת מתחיל לרוץ ונרשם להאזנה על פורט מוגדר

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import './db/index.js'; // מאתחל את ה-DB ויוצר טבלאות
import { seedIfEmpty } from './db/seed.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import orianRouter from './routes/orian.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

// מאכלס את ה-DB בנתוני התחלה אם הוא ריק
await seedIfEmpty();

const app = express();
const PORT = process.env.PORT || 3001;

// === Middlewares גלובליים ===

// אבטחה בסיסית - מוסיף HTTP headers שמגנים מהתקפות נפוצות
app.use(helmet());

// CORS - מאפשר ל-Frontend (שירוץ על פורט אחר) לדבר עם השרת
app.use(cors());

// קריאת JSON בגוף הבקשה
app.use(express.json());

// רישום אוטומטי של כל בקשה ב-console (לבדיקות בזמן פיתוח)
app.use(morgan('dev'));

// === נתיבים (Routes) ===

// /api/health - בדיקה שהשרת חי
app.use('/api/health', healthRouter);

// /api/auth - התחברות וניהול משתמשים מחוברים
app.use('/api/auth', authRouter);

// /api/orian - תקשורת עם API של חברת אוריין
app.use('/api/orian', orianRouter);

// === טיפול בשגיאות ===

// 404 - נתיב לא נמצא
app.use(notFoundHandler);

// טיפול כללי בשגיאות
app.use(errorHandler);

// === הפעלת השרת ===

app.listen(PORT, () => {
  console.log(`\n🚀 שרת מייה אינספיריישן רץ על http://localhost:${PORT}`);
  console.log(`📍 בדיקת חיים: http://localhost:${PORT}/api/health\n`);
});
