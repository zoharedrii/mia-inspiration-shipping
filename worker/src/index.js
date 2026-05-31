// נקודת הכניסה של ה-Worker (Cloudflare).
//
// זה התחליף ל-server/src/index.js של Express. הבדלים עיקריים:
// - אין app.listen - Cloudflare מריצה את ה-Worker עבור כל בקשה.
// - אין הגשת Frontend מכאן - ה-React app מתארח בנפרד ב-Cloudflare Pages.
// - ה-DB (D1) מגיע דרך c.env.DB ולא כ-import גלובלי.
// - אין seedIfEmpty - מאכלסים את ה-DB ידנית עם `npm run db:seed:local/remote`.

import { Hono } from 'hono';
import { cors } from 'hono/cors';

import health from './routes/health.js';
import auth from './routes/auth.js';
import users from './routes/users.js';
import branches from './routes/branches.js';
import shipments from './routes/shipments.js';
import reports from './routes/reports.js';
import orian from './routes/orian.js';

const app = new Hono();

// CORS - מאפשר ל-Frontend לדבר עם ה-API
// מורשים: Cloudflare Pages שלנו (כולל preview deployments) + localhost לפיתוח
app.use('*', cors({
  origin: (origin) => {
    if (!origin) return origin;
    // Pages production + כל preview deployments (*.pages.dev)
    if (origin.endsWith('.pages.dev') || origin === 'https://mia-shipping-frontend.pages.dev') {
      return origin;
    }
    // פיתוח מקומי
    if (origin.startsWith('http://localhost:')) return origin;
    return null;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// === נתיבים ===
app.route('/api/health', health);
app.route('/api/auth', auth);
app.route('/api/users', users);
app.route('/api/branches', branches);
app.route('/api/shipments', shipments);
app.route('/api/reports', reports);
app.route('/api/orian', orian);

// === טיפול בשגיאות ===
app.notFound((c) => {
  return c.json({ error: 'נתיב לא נמצא', path: c.req.path, method: c.req.method }, 404);
});

app.onError((err, c) => {
  console.error('❌ שגיאה:', err);
  return c.json({ error: err.message || 'שגיאת שרת פנימית' }, err.statusCode || 500);
});

export default app;
