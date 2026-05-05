// נקודת הכניסה של שרת ה-Backend
// כאן השרת מתחיל לרוץ ונרשם להאזנה על פורט מוגדר

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import healthRouter from './routes/health.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

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
