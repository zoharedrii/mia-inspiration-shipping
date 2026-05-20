// Routes לדוחות
//
// כל הדוחות מוגבלים ל-admin, accounting, ו-warehouse.
// סניפים בודדים לא ניגשים לדוחות (האפיון מסביר את זה).

import { Router } from 'express';
import * as reports from '../services/reports.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// כל ה-routes מתחת ייאלצו את ההרשאות:
// דוחות זמינים רק למנהל מערכת ולמנהל מחסן
router.use(requireAuth);
router.use(requireRole('admin', 'warehouse'));

/**
 * עזר: מחזיר תאריך התחלה וסיום של החודש הנוכחי בפורמט YYYY-MM-DD
 */
function thisMonthRange() {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString().slice(0, 10);
  const to = new Date(today.getFullYear(), today.getMonth() + 1, 1)
    .toISOString().slice(0, 10);
  return { from, to };
}

/**
 * GET /api/reports/monthly?year=2026&month=5
 * אם לא מועברים פרמטרים - מחזיר את החודש הנוכחי.
 */
router.get('/monthly', (req, res) => {
  try {
    const now = new Date();
    const year = parseInt(req.query.year, 10) || now.getFullYear();
    const month = parseInt(req.query.month, 10) || now.getMonth() + 1;

    if (month < 1 || month > 12) {
      return res.status(400).json({ error: 'חודש חייב להיות 1-12' });
    }

    res.json(reports.getMonthlyReport(year, month));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/reports/mismatches?from=YYYY-MM-DD&to=YYYY-MM-DD
 * אם לא מועברים פרמטרים - מחזיר את החודש הנוכחי.
 */
router.get('/mismatches', (req, res) => {
  try {
    const defaults = thisMonthRange();
    const from = req.query.from || defaults.from;
    const to = req.query.to || defaults.to;

    res.json(reports.getMismatchesReport(from, to));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/reports/active
 * מחזיר את כל המשלוחים שעוד לא הסתיימו.
 */
router.get('/active', (req, res) => {
  try {
    res.json(reports.getActiveShipmentsReport());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/reports/branch/:id?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
router.get('/branch/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const defaults = thisMonthRange();
    const from = req.query.from || defaults.from;
    const to = req.query.to || defaults.to;

    res.json(reports.getBranchActivityReport(id, from, to));
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

export default router;
