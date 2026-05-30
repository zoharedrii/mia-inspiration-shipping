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
      message: '✅ התחברות לאוריין הצליחה',
      tokenReceived: Boolean(token),
      tokenLength: token?.length ?? 0,
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

export default router;
