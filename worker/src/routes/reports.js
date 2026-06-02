// Routes לדוחות. מוגבלים ל-admin, warehouse ו-accounting (קריאה בלבד).

import { Hono } from 'hono';
import * as reports from '../services/reports.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = new Hono();

// דוחות זמינים למנהל מערכת, למנהל מחסן ולהנהלת חשבונות (הנה"ח = צפייה בלבד)
router.use('*', requireAuth, requireRole('admin', 'warehouse', 'accounting'));

/**
 * עזר: תאריך התחלה וסיום של החודש הנוכחי בפורמט YYYY-MM-DD
 */
function thisMonthRange() {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const to = new Date(today.getFullYear(), today.getMonth() + 1, 1).toISOString().slice(0, 10);
  return { from, to };
}

/**
 * GET /api/reports/monthly?year=2026&month=5
 */
router.get('/monthly', async (c) => {
  try {
    const now = new Date();
    const year = parseInt(c.req.query('year'), 10) || now.getFullYear();
    const month = parseInt(c.req.query('month'), 10) || now.getMonth() + 1;

    if (month < 1 || month > 12) {
      return c.json({ error: 'חודש חייב להיות 1-12' }, 400);
    }

    return c.json(await reports.getMonthlyReport(c.env.DB, year, month));
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

/**
 * GET /api/reports/mismatches?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
router.get('/mismatches', async (c) => {
  try {
    const defaults = thisMonthRange();
    const from = c.req.query('from') || defaults.from;
    const to = c.req.query('to') || defaults.to;
    return c.json(await reports.getMismatchesReport(c.env.DB, from, to));
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

/**
 * GET /api/reports/active - כל המשלוחים שעוד לא הסתיימו.
 */
router.get('/active', async (c) => {
  try {
    return c.json(await reports.getActiveShipmentsReport(c.env.DB));
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

/**
 * GET /api/reports/branch/:id?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
router.get('/branch/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    const defaults = thisMonthRange();
    const from = c.req.query('from') || defaults.from;
    const to = c.req.query('to') || defaults.to;
    return c.json(await reports.getBranchActivityReport(c.env.DB, id, from, to));
  } catch (error) {
    return c.json({ error: error.message }, error.statusCode || 500);
  }
});

export default router;
