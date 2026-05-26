// Routes למשלוחים
//
// כל הendpoints דורשים אימות (login).
// יצירה ועדכון מוגבלים לתפקידים מסוימים.

import { Router } from 'express';
import * as shipments from '../services/shipments.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/shipments
 * יצירת משלוח חדש.
 * הרשאה: admin, warehouse, branch (כל מי שיכול לשלוח משלוח)
 *
 * Body: { source_branch_id, target_branch_id, package_count, package_type?, notes? }
 */
router.post('/', requireAuth, requireRole('admin', 'warehouse', 'branch'), (req, res) => {
  try {
    // אם המשתמש הוא branch - מאלצים את source_branch להיות הסניף שלו
    const data = { ...req.body };
    if (req.user.role === 'branch') {
      data.source_branch_id = req.user.branch_id;
    }
    if (req.user.role === 'warehouse') {
      data.source_branch_id = req.user.branch_id;
    }

    const shipment = shipments.createShipment(data, req.user.id);
    res.status(201).json({ shipment });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

/**
 * GET /api/shipments
 * רשימת משלוחים.
 * משתמש סניף רואה רק משלוחים של הסניף שלו.
 * מנהל / חשבונאות / מחסן רואים הכל.
 *
 * Query params: ?status=...&branch_id=...
 */
router.get('/', requireAuth, (req, res) => {
  try {
    const { status, branch_id, search, from, to } = req.query;
    const filters = {};

    if (status) filters.status = status;
    if (search) filters.search = search;
    if (from) filters.from = from;
    if (to) filters.to = to;

    // הגבלת תצוגה לסניף שלו אם המשתמש הוא branch
    if (req.user.role === 'branch') {
      filters.branch_id = req.user.branch_id;
    } else if (branch_id) {
      filters.branch_id = parseInt(branch_id, 10);
    }

    res.json({ shipments: shipments.getShipments(filters) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/shipments/:id
 * פרטי משלוח בודד.
 */
router.get('/:id', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const shipment = shipments.getShipmentById(id);

    if (!shipment) {
      return res.status(404).json({ error: 'המשלוח לא נמצא' });
    }

    // משתמש branch יכול לראות רק משלוחים של הסניף שלו
    if (
      req.user.role === 'branch' &&
      shipment.source_branch_id !== req.user.branch_id &&
      shipment.target_branch_id !== req.user.branch_id
    ) {
      return res.status(403).json({ error: 'אין הרשאה לצפות במשלוח זה' });
    }

    res.json({ shipment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/shipments/:id/cancel
 * ביטול משלוח.
 * הרשאות מובנות בשירות (admin/branch של היוצר בסטטוס pending).
 *
 * Body: { reason? }
 */
router.post('/:id/cancel', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { reason } = req.body || {};
    const cancelled = shipments.cancelShipment(id, req.user, reason);
    res.json({ shipment: cancelled });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

/**
 * GET /api/shipments/:id/history
 * היסטוריית שינויי הסטטוס של המשלוח.
 */
router.get('/:id/history', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const shipment = shipments.getShipmentById(id);

    if (!shipment) {
      return res.status(404).json({ error: 'המשלוח לא נמצא' });
    }

    // משתמש branch רואה היסטוריה רק של משלוחים של הסניף שלו
    if (
      req.user.role === 'branch' &&
      shipment.source_branch_id !== req.user.branch_id &&
      shipment.target_branch_id !== req.user.branch_id
    ) {
      return res.status(403).json({ error: 'אין הרשאה לצפות במשלוח זה' });
    }

    res.json({ history: shipments.getShipmentHistory(id) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/shipments/:id/status
 * שינוי סטטוס ידני.
 * הרשאה: admin, warehouse
 *
 * Body: { status, notes? }
 */
router.patch('/:id/status', requireAuth, requireRole('admin', 'warehouse'), (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status, notes } = req.body || {};
    const updated = shipments.updateStatus(id, status, req.user.id, notes);
    res.json({ shipment: updated });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

/**
 * POST /api/shipments/:id/receive
 * אישור קבלה - עם בדיקת התאמת כמויות.
 * הרשאה: admin, branch (הסניף המקבל)
 *
 * Body: { received_count, notes? }
 */
router.post('/:id/receive', requireAuth, requireRole('admin', 'branch'), (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { received_count, notes } = req.body || {};

    // ולידציה: סניף יכול לאשר רק משלוחים שמיועדים אליו
    const shipment = shipments.getShipmentById(id);
    if (!shipment) {
      return res.status(404).json({ error: 'המשלוח לא נמצא' });
    }
    if (req.user.role === 'branch' && shipment.target_branch_id !== req.user.branch_id) {
      return res.status(403).json({ error: 'אין הרשאה לאשר משלוח שלא מיועד לסניף שלך' });
    }

    const updated = shipments.confirmReceipt(id, received_count, req.user.id, notes);
    res.json({ shipment: updated });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

export default router;
