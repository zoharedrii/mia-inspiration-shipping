// Routes לבדיקת התקשורת עם אוריין.

import { Hono } from 'hono';
import * as orian from '../services/orian/index.js';

const router = new Hono();

/**
 * GET /api/orian/test - בודק חיבור לאוריין על ידי ביצוע Login.
 */
router.get('/test', async (c) => {
  try {
    const token = await orian.login(c.env);
    return c.json({
      status: 'ok',
      message: '✅ התחברות לאוריין הצליחה — AuthToken התקבל',
      tokenReceived: Boolean(token),
      environment: c.env.ORIAN_BASE_URL,
    });
  } catch (error) {
    return c.json(
      {
        status: 'error',
        message: '❌ התחברות לאוריין נכשלה',
        reason: error.message,
        hint: 'בדקי שהמשתנים ORIAN_USERNAME, ORIAN_PASSWORD ו-ORIAN_BASE_URL מוגדרים נכון',
        environment: c.env.ORIAN_BASE_URL || '(לא מוגדר)',
      },
      500
    );
  }
});

/**
 * GET /api/orian/package-status?package=...  — route זמני לבדיקה.
 * בודק איזה מזהה אוריין מקבלת ב-GetPackageStatus (reference_id / PACKAGEID / TRANSPORTATIONORDERID).
 * אפשר כמה מזהים מופרדים בפסיק.
 */
router.get('/package-status', async (c) => {
  const pkg = c.req.query('package');
  if (!pkg) {
    return c.json({ status: 'error', message: 'חסר פרמטר package' }, 400);
  }
  try {
    const statuses = await orian.getPackageStatus(c.env, pkg.split(','));
    return c.json({ status: 'ok', query: pkg, statuses });
  } catch (error) {
    return c.json({ status: 'error', query: pkg, reason: error.message }, 500);
  }
});

export default router;
