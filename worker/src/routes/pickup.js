// Routes לסריקת חבילות לאיסוף מסניף.

import { Hono } from 'hono';
import { scanPickupOrder } from '../services/pickup.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = new Hono();

/**
 * POST /api/pickup/scan - סריקת חבילה של לקוחה שהגיעה לסניף.
 * הרשאה: branch בלבד (הסריקה משויכת לסניף של המשתמשת).
 * Body: { order_number }
 * תמיד מחזיר 200 עם ok=true/false כדי שהמסך יציג את ההודעה,
 * חוץ משגיאות אמיתיות (חוסר הגדרה / מערכת האיסוף לא זמינה).
 */
router.post('/scan', requireAuth, requireRole('branch'), async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json().catch(() => ({}));
    const result = await scanPickupOrder(c.env.DB, c.env, user, body.order_number);
    return c.json(result);
  } catch (error) {
    return c.json({ error: error.message }, error.statusCode || 500);
  }
});

export default router;
