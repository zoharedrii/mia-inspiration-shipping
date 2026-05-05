// Routes לבדיקת התקשורת עם אוריין
//
// כרגע רק endpoint לבדיקת חיבור. בהמשך יתווספו:
// - יצירת הזמנת משלוח (CreateTransportationOrder)
// - קבלת סטטוס חבילה (GetPackageStatus)

import { Router } from 'express';
import * as orian from '../services/orian/index.js';

const router = Router();

/**
 * GET /api/orian/test
 * בודק חיבור לאוריין על ידי ביצוע Login.
 * אם הצליח - מחזיר סטטוס חיובי (בלי לחשוף את הטוקן עצמו).
 * אם נכשל - מחזיר את השגיאה כדי שנדע מה הבעיה.
 */
router.get('/test', async (req, res, next) => {
  try {
    const token = await orian.login();
    res.json({
      status: 'ok',
      message: '✅ התחברות לאוריין הצליחה',
      tokenReceived: Boolean(token),
      tokenLength: token?.length ?? 0,
      environment: process.env.ORIAN_BASE_URL,
    });
  } catch (error) {
    // מעבירים את השגיאה ל-errorHandler עם פרטים שימושיים
    res.status(500).json({
      status: 'error',
      message: '❌ התחברות לאוריין נכשלה',
      reason: error.message,
      hint: 'בדקי שהמשתנים ORIAN_USERNAME, ORIAN_PASSWORD ו-ORIAN_BASE_URL מוגדרים נכון ב-.env',
      environment: process.env.ORIAN_BASE_URL || '(לא מוגדר)',
    });
  }
});

export default router;
