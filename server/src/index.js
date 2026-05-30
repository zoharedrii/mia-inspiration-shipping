// נקודת הכניסה של שרת ה-Backend
// כאן השרת מתחיל לרוץ ונרשם להאזנה על פורט מוגדר

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

// __dirname לא קיים ב-ESM — מחשבים אותו ידנית
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// נתיב לתיקיית ה-React המבנה (client/dist) — בפרודקשן קיים אחרי npm run build
const clientDist = path.join(__dirname, '../../client/dist');

import './db/index.js'; // מאתחל את ה-DB ויוצר טבלאות
import { seedIfEmpty } from './db/seed.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import branchesRouter from './routes/branches.js';
import shipmentsRouter from './routes/shipments.js';
import reportsRouter from './routes/reports.js';
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

// /api/users - ניהול משתמשים (admin בלבד)
app.use('/api/users', usersRouter);

// /api/branches - רשימת סניפים (לטופס יצירת משלוח)
app.use('/api/branches', branchesRouter);

// /api/shipments - ניהול משלוחים
app.use('/api/shipments', shipmentsRouter);

// /api/reports - דוחות וניתוחים
app.use('/api/reports', reportsRouter);

// /api/orian - תקשורת עם API של חברת אוריין
app.use('/api/orian', orianRouter);

// === הגשת Frontend (פרודקשן בלבד) ===
// מגיש את ה-React app הבנוי. חייב לבוא אחרי כל ה-API routes.
app.use(express.static(clientDist));
// כל בקשה שאינה /api/* מועברת ל-index.html כדי ש-React Router יטפל בה
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next(); // API 404 ← notFoundHandler
  res.sendFile(path.join(clientDist, 'index.html'));
});

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
