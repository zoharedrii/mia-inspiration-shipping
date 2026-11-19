// Routes להזמנות איסוף (לקוחות שבחרו לאסוף מסניף).
// הנתונים עצמם יושבים במערכת בחירת הסניף - ראו services/pickup.js.
//
// משתמשת סניף רואה ומאשרת רק הזמנות של הסניף שלה.
// מנהלת (admin) רואה את כל הסניפים, ובפעולה שולחת pickup_branch_id
// (מספר הסניף של ההזמנה במערכת האיסוף, כפי שהגיע ברשימה).

import { Hono } from 'hono';
import * as pickup from '../services/pickup.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { httpError } from '../lib/http.js';

const router = new Hono();

/**
 * GET /api/pickup-orders - הזמנות בדרך לסניף + ממתינות ללקוחה.
 * סניף - רק שלה. מנהלת - כל הסניפים.
 */
router.get('/', requireAuth, requireRole('admin', 'branch'), async (c) => {
  try {
    const user = c.get('user');
    let pickupBranchId = null;
    if (user.role === 'branch') {
      pickupBranchId = await pickup.getPickupBranchId(c.env.DB, user.branch_id);
    }
    const orders = await pickup.listOrders(c.env, pickupBranchId);
    return c.json({ orders: orders });
  } catch (error) {
    return c.json({ error: error.message }, error.statusCode || 500);
  }
});

/**
 * פעולה על הזמנה (receive / handover) - משותף לשני ה-endpoints.
 */
async function handleOrderAction(c, action) {
  try {
    const user = c.get('user');
    const body = await c.req.json().catch(() => ({}));

    const orderNumber = pickup.cleanOrderNumber(c.req.param('orderNumber'));
    if (!orderNumber) {
      throw httpError('חסר מספר הזמנה', 400);
    }

    let pickupBranchId;
    if (user.role === 'branch') {
      pickupBranchId = await pickup.getPickupBranchId(c.env.DB, user.branch_id);
    } else {
      pickupBranchId = parseInt(body.pickup_branch_id, 10);
    }
    if (!pickupBranchId) {
      throw httpError('יש לבחור סניף', 400);
    }

    const actorName = user.full_name || user.username;
    let result;
    if (action === 'receive') {
      result = await pickup.receiveOrder(c.env, orderNumber, pickupBranchId, actorName);
    } else {
      result = await pickup.handoverOrder(c.env, orderNumber, pickupBranchId, actorName, 'branch');
    }
    return c.json(result);
  } catch (error) {
    const response = { error: error.message };
    if (error.correctBranch) {
      response.correct_branch = error.correctBranch;
    }
    return c.json(response, error.statusCode || 500);
  }
}

/**
 * POST /api/pickup-orders/:orderNumber/receive - "ההזמנה הגיעה לסניף".
 * הלקוחה מקבלת SMS עם לינק לאישור איסוף.
 */
router.post('/:orderNumber/receive', requireAuth, requireRole('admin', 'branch'), (c) =>
  handleOrderAction(c, 'receive')
);

/**
 * POST /api/pickup-orders/:orderNumber/handover - "נמסרה ללקוחה".
 * למקרה שהלקוחה אספה ולא לחצה על הלינק.
 */
router.post('/:orderNumber/handover', requireAuth, requireRole('admin', 'branch'), (c) =>
  handleOrderAction(c, 'handover')
);

/**
 * POST /api/pickup-orders/:orderNumber/resend-sms - שליחת ה-SMS ללקוחה שוב
 * (למשל אחרי כשל בשליחה). סניף - רק להזמנות של הסניף שלה.
 */
router.post('/:orderNumber/resend-sms', requireAuth, requireRole('admin', 'branch'), async (c) => {
  try {
    const user = c.get('user');
    if (c.env.PICKUP_SMS_ENABLED !== '1') {
      throw httpError('שליחת SMS ללקוחות כבויה כרגע', 409);
    }
    const orderNumber = pickup.cleanOrderNumber(c.req.param('orderNumber'));
    const row = await pickup.getNotification(c.env.DB, orderNumber);
    if (!row) {
      throw httpError('ההזמנה עוד לא אושרה כהתקבלה בסניף', 409);
    }
    if (user.role === 'branch') {
      const pickupBranchId = await pickup.getPickupBranchId(c.env.DB, user.branch_id);
      if (row.pickup_branch_id !== pickupBranchId) {
        throw httpError('ההזמנה הזו לא שייכת לסניף שלך.', 403);
      }
    }
    const smsStatus = await pickup.sendArrivalSms(c.env, orderNumber);
    return c.json({ success: true, order_number: orderNumber, sms_status: smsStatus });
  } catch (error) {
    return c.json({ error: error.message }, error.statusCode || 500);
  }
});

export default router;
