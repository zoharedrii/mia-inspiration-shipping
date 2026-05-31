// Routes למשלוחים.
// כל ה-endpoints דורשים אימות. יצירה ועדכון מוגבלים לתפקידים מסוימים.

import { Hono } from 'hono';
import * as shipments from '../services/shipments.js';
import { getTransportationOrderLabel } from '../services/orian/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = new Hono();

/**
 * POST /api/shipments - יצירת משלוח חדש.
 * הרשאה: admin, warehouse, branch.
 * Body: { source_branch_id, target_branch_id, package_count, package_type?, notes? }
 */
router.post('/', requireAuth, requireRole('admin', 'warehouse', 'branch'), async (c) => {
  try {
    const user = c.get('user');
    const data = { ...(await c.req.json().catch(() => ({}))) };
    // branch / warehouse - מאלצים את source_branch להיות הסניף שלהם
    if (user.role === 'branch' || user.role === 'warehouse') {
      data.source_branch_id = user.branch_id;
    }
    const shipment = await shipments.createShipment(c.env.DB, c.env, data, user.id);
    return c.json({ shipment }, 201);
  } catch (error) {
    return c.json({ error: error.message }, error.statusCode || 500);
  }
});

/**
 * GET /api/shipments - רשימת משלוחים.
 * סניף רואה רק את שלו. Query: ?status=&branch_id=&search=&from=&to=
 */
router.get('/', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const filters = {};

    const status = c.req.query('status');
    const search = c.req.query('search');
    const from = c.req.query('from');
    const to = c.req.query('to');
    const branchIdQuery = c.req.query('branch_id');

    if (status) filters.status = status;
    if (search) filters.search = search;
    if (from) filters.from = from;
    if (to) filters.to = to;

    if (user.role === 'branch') {
      filters.branch_id = user.branch_id;
    } else if (branchIdQuery) {
      filters.branch_id = parseInt(branchIdQuery, 10);
    }

    return c.json({ shipments: await shipments.getShipments(c.env.DB, filters) });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

/**
 * GET /api/shipments/:id - פרטי משלוח בודד.
 */
router.get('/:id', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const id = parseInt(c.req.param('id'), 10);
    const shipment = await shipments.getShipmentById(c.env.DB, id);

    if (!shipment) {
      return c.json({ error: 'המשלוח לא נמצא' }, 404);
    }

    if (
      user.role === 'branch' &&
      shipment.source_branch_id !== user.branch_id &&
      shipment.target_branch_id !== user.branch_id
    ) {
      return c.json({ error: 'אין הרשאה לצפות במשלוח זה' }, 403);
    }

    return c.json({ shipment });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

/**
 * POST /api/shipments/:id/mark-sent - סימון המשלוח כ"נשלח".
 * Body: { action: 'print' | 'mark_sent' }
 */
router.post('/:id/mark-sent', requireAuth, requireRole('admin', 'warehouse', 'branch'), async (c) => {
  try {
    const user = c.get('user');
    const id = parseInt(c.req.param('id'), 10);
    const { action } = await c.req.json().catch(() => ({}));
    const isPrint = action === 'print';

    // branch יכול לסמן כנשלח רק משלוחים שיצר
    if (user.role === 'branch') {
      const shipment = await shipments.getShipmentById(c.env.DB, id);
      if (!shipment) {
        return c.json({ error: 'המשלוח לא נמצא' }, 404);
      }
      if (shipment.created_by !== user.id) {
        return c.json({ error: 'ניתן לסמן כנשלח רק משלוחים שיצרת' }, 403);
      }
    }

    const result = await shipments.markAsSent(c.env.DB, id, user.id, isPrint ? 'print' : 'mark_sent');
    return c.json(result);
  } catch (error) {
    return c.json({ error: error.message }, error.statusCode || 500);
  }
});

/**
 * POST /api/shipments/:id/mark-not-received - סניף היעד מסמן שלא הגיע.
 * Body: { notes? }
 */
router.post('/:id/mark-not-received', requireAuth, requireRole('admin', 'branch'), async (c) => {
  try {
    const user = c.get('user');
    const id = parseInt(c.req.param('id'), 10);
    const { notes } = await c.req.json().catch(() => ({}));

    if (user.role === 'branch') {
      const shipment = await shipments.getShipmentById(c.env.DB, id);
      if (!shipment) {
        return c.json({ error: 'המשלוח לא נמצא' }, 404);
      }
      if (shipment.target_branch_id !== user.branch_id) {
        return c.json({ error: 'ניתן לסמן רק משלוחים שמיועדים לסניף שלך' }, 403);
      }
    }

    const updated = await shipments.markNotReceived(c.env.DB, id, user.id, notes);
    return c.json({ shipment: updated });
  } catch (error) {
    return c.json({ error: error.message }, error.statusCode || 500);
  }
});

/**
 * POST /api/shipments/:id/cancel - ביטול משלוח (הרשאות מובנות בשירות).
 * Body: { reason? }
 */
router.post('/:id/cancel', requireAuth, async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    const { reason } = await c.req.json().catch(() => ({}));
    const cancelled = await shipments.cancelShipment(c.env.DB, id, c.get('user'), reason);
    return c.json({ shipment: cancelled });
  } catch (error) {
    return c.json({ error: error.message }, error.statusCode || 500);
  }
});

/**
 * GET /api/shipments/:id/history - היסטוריית שינויי הסטטוס.
 */
router.get('/:id/history', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const id = parseInt(c.req.param('id'), 10);
    const shipment = await shipments.getShipmentById(c.env.DB, id);

    if (!shipment) {
      return c.json({ error: 'המשלוח לא נמצא' }, 404);
    }

    if (
      user.role === 'branch' &&
      shipment.source_branch_id !== user.branch_id &&
      shipment.target_branch_id !== user.branch_id
    ) {
      return c.json({ error: 'אין הרשאה לצפות במשלוח זה' }, 403);
    }

    return c.json({ history: await shipments.getShipmentHistory(c.env.DB, id) });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

/**
 * PATCH /api/shipments/:id/status - שינוי סטטוס ידני.
 * הרשאה: admin, warehouse. Body: { status, notes? }
 */
router.patch('/:id/status', requireAuth, requireRole('admin', 'warehouse'), async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    const { status, notes } = await c.req.json().catch(() => ({}));
    const updated = await shipments.updateStatus(c.env.DB, id, status, c.get('user').id, notes);
    return c.json({ shipment: updated });
  } catch (error) {
    return c.json({ error: error.message }, error.statusCode || 500);
  }
});

/**
 * POST /api/shipments/:id/receive - אישור קבלה עם בדיקת התאמת כמויות.
 * הרשאה: admin, branch (הסניף המקבל). Body: { received_count, notes? }
 */
router.post('/:id/receive', requireAuth, requireRole('admin', 'branch'), async (c) => {
  try {
    const user = c.get('user');
    const id = parseInt(c.req.param('id'), 10);
    const { received_count, notes } = await c.req.json().catch(() => ({}));

    const shipment = await shipments.getShipmentById(c.env.DB, id);
    if (!shipment) {
      return c.json({ error: 'המשלוח לא נמצא' }, 404);
    }
    if (user.role === 'branch' && shipment.target_branch_id !== user.branch_id) {
      return c.json({ error: 'אין הרשאה לאשר משלוח שלא מיועד לסניף שלך' }, 403);
    }

    const updated = await shipments.confirmReceipt(c.env.DB, id, received_count, user.id, notes);
    return c.json({ shipment: updated });
  } catch (error) {
    return c.json({ error: error.message }, error.statusCode || 500);
  }
});

/**
 * GET /api/shipments/:id/label - מושך מדבקת שילוח PDF מאוריין.
 * מחזיר את ה-PDF כ-Base64 + data URL מוכן להצגה בדפדפן.
 * הרשאה: admin, warehouse, branch.
 * הערה: עובד רק במצב live (ORIAN_MODE=live) ורק אחרי יצירת הזמנה מוצלחת.
 */
router.get('/:id/label', requireAuth, requireRole('admin', 'warehouse', 'branch'), async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    const shipment = await shipments.getShipmentById(c.env.DB, id);
    if (!shipment) {
      return c.json({ error: 'המשלוח לא נמצא' }, 404);
    }
    if (!shipment.orian_order_id) {
      return c.json({ error: 'המשלוח עדיין לא קיבל מספר הזמנה מאוריין' }, 400);
    }
    if (c.env.ORIAN_MODE !== 'live') {
      return c.json({
        error: 'מדבקות זמינות רק במצב live',
        hint: 'שנה ORIAN_MODE=live ב-wrangler.toml',
      }, 400);
    }

    // reference_id שלנו = REFERENCEORDER שנשלח לאוריין
    const labelBase64 = await getTransportationOrderLabel(c.env, shipment.reference_id);

    return c.json({
      shipment_id: id,
      reference_id: shipment.reference_id,
      // data URL מוכן לשימוש ב-<iframe> או window.open
      label_pdf: `data:application/pdf;base64,${labelBase64}`,
      label_base64: labelBase64,
    });
  } catch (error) {
    return c.json({ error: error.message }, error.statusCode || 500);
  }
});

export default router;
