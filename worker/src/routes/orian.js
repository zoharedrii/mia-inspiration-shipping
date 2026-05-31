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
    // בסביבת טסט הטוקן הוא "Authorized" (לא JWT של פרודקשן)
    const isTestMode = token === 'Authorized' || token.startsWith('Basic ');
    return c.json({
      status: 'ok',
      message: isTestMode
        ? '✅ חיבור לאוריין הצליח (סביבת טסט — AuthToken="Authorized")'
        : '✅ התחברות לאוריין הצליחה',
      tokenReceived: Boolean(token),
      isTestCredentials: isTestMode,
      environment: c.env.ORIAN_BASE_URL,
      note: isTestMode ? 'פרטי פרודקשן יחליפו זאת לטוקן אמיתי' : undefined,
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
