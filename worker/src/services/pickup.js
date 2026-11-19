// שירות הזמנות איסוף - מדבר עם מערכת בחירת הסניף (branch-pickup-worker).
//
// מערכת בחירת הסניף מחזיקה את ההזמנות (מקבלת אותן משופיפיי ומעדכנת את שופיפיי).
// מערכת המשלוחים מנהלת את התהליך מול הסניף והלקוחה:
//   1. הסניף מאשר "התקבל"  -> מעדכנים את מערכת האיסוף (היא לא שולחת SMS)
//                            -> אנחנו שולחים ללקוחה SMS עם לינק (services/sms.js)
//   2. הלקוחה לוחצת בלינק  -> אנחנו שולחים למערכת האיסוף "נסגרה" (handover)
//      או שהסניף לוחץ "נמסרה ללקוחה" - אותה פעולה.
// מה שעשינו מול הלקוחה נשמר אצלנו בטבלה pickup_notifications.
//
// האימות בין המערכות: מפתח סודי משותף שנשלח ב-header בשם X-Internal-Key.
// משתני סביבה נדרשים:
//   PICKUP_API_URL - כתובת מערכת בחירת הסניף (לא סוד, מוגדר ב-wrangler.toml)
//   PICKUP_API_KEY - המפתח הסודי (סוד, מוגדר דרך wrangler secret put)

import { httpError } from '../lib/http.js';
import { sendSms } from './sms.js';
import { buildPickupLink } from './pickupLink.js';

// שמות סטטוסים בעברית - להודעות שגיאה ברורות לעובדת בסניף
const STATUS_LABELS = {
  awaiting_branch: 'ממתינה לבחירת סניף',
  pending: 'עוד לא יצאה מהמחסן',
  in_transit: 'בדרך לסניף',
  waiting_pickup: 'כבר התקבלה בסניף וממתינה ללקוחה',
  completed: 'כבר נאספה',
  wrong_branch: 'סומנה כהגיעה לסניף שגוי',
  switched_delivery: 'הועברה למשלוח עד הבית',
};

/**
 * שולח בקשה למערכת בחירת הסניף ומחזיר { status, data }.
 */
async function callPickupApi(env, path, method, body) {
  if (!env.PICKUP_API_URL || !env.PICKUP_API_KEY) {
    throw httpError('החיבור למערכת האיסוף לא מוגדר', 503);
  }

  const baseUrl = env.PICKUP_API_URL.replace(/\/$/, '');
  const options = {
    method: method,
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Key': env.PICKUP_API_KEY,
    },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(baseUrl + path, options);
  } catch (error) {
    throw httpError('אין תקשורת עם מערכת האיסוף, נסי שוב בעוד רגע', 502);
  }

  const data = await response.json().catch(() => ({}));
  // רושמים בלוג כל תשובת שגיאה ממערכת האיסוף - כדי שאפשר יהיה להבין תקלות (wrangler tail)
  if (!response.ok) {
    console.error('pickup api error', method, path.split('?')[0], response.status, JSON.stringify(data).slice(0, 200));
  }
  return { status: response.status, data: data };
}

/**
 * מחזיר את מספר הסניף במערכת בחירת הסניף עבור סניף שלנו.
 * זורק שגיאה אם הסניף עוד לא מקושר.
 */
export async function getPickupBranchId(db, branchId) {
  const row = await db
    .prepare('SELECT pickup_branch_id FROM branches WHERE id = ?')
    .bind(branchId)
    .first();

  if (!row || !row.pickup_branch_id) {
    throw httpError('הסניף הזה עוד לא מקושר למערכת הזמנות האיסוף. פני למנהלת המערכת.', 409);
  }
  return row.pickup_branch_id;
}

/**
 * מנקה מספר הזמנה שהגיע מסריקה או הקלדה: מוריד רווחים ו-#.
 */
export function cleanOrderNumber(value) {
  return String(value || '').replace('#', '').trim();
}

/**
 * רשימת הזמנות איסוף של סניף: בדרך לסניף + ממתינות ללקוחה.
 * pickupBranchId ריק = כל הסניפים (למנהלת).
 */
export async function listOrders(env, pickupBranchId) {
  let path = '/internal/orders?status=in_transit,waiting_pickup';
  if (pickupBranchId) {
    path += '&branch_id=' + pickupBranchId;
  }

  const { status, data } = await callPickupApi(env, path, 'GET');
  if (status !== 200) {
    throw httpError('לא הצלחנו לטעון את הזמנות האיסוף', 502);
  }
  const orders = data.orders || [];

  // מצרפים לכל הזמנה את סטטוס ה-SMS שלנו (נשלח / נכשל)
  const notifications = await getNotifications(env.DB, orders.map((o) => String(o.order_number)));
  return orders.map((order) => {
    const notification = notifications[String(order.order_number)];
    return {
      order_number: order.order_number,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone || null, // מוצג לסניף כדי שאפשר יהיה להתקשר ללקוחה
      branch_id: order.branch_id,
      branch_name: order.branch_name,
      status: order.status,
      updated_at: order.updated_at,
      sms_status: notification ? notification.sms_status : null,
    };
  });
}

/**
 * מחזיר את הרשומות שלנו עבור רשימת הזמנות, כאובייקט לפי מספר הזמנה.
 */
async function getNotifications(db, orderNumbers) {
  const result = {};
  if (orderNumbers.length === 0) {
    return result;
  }
  const placeholders = orderNumbers.map(() => '?').join(',');
  const { results } = await db
    .prepare(`SELECT order_number, sms_status FROM pickup_notifications WHERE order_number IN (${placeholders})`)
    .bind(...orderNumbers)
    .all();
  for (const row of results || []) {
    result[row.order_number] = row;
  }
  return result;
}

export async function getNotification(db, orderNumber) {
  return db
    .prepare('SELECT * FROM pickup_notifications WHERE order_number = ?')
    .bind(String(orderNumber))
    .first();
}

/**
 * נוסח ה-SMS ללקוחה (אושר בתוכנית).
 */
function buildArrivalMessage(customerName, orderNumber, branchName, link) {
  const firstName = String(customerName || '').split(' ')[0];
  return (
    `היי ${firstName}, ההזמנה שלך (#${orderNumber}) מחכה לך בסניף ${branchName} 🛍️\n` +
    `כשתגיעי לאסוף, אשרי את האיסוף בלינק:\n` +
    `${link}\n` +
    `צוות Mia Inspiration`
  );
}

/**
 * שולח ללקוחה SMS על הגעת ההזמנה ומעדכן את הרשומה שלנו.
 * מחזיר את סטטוס ה-SMS: sent / failed / no_phone.
 */
export async function sendArrivalSms(env, orderNumber) {
  const row = await getNotification(env.DB, orderNumber);
  if (!row) {
    throw httpError('ההזמנה עוד לא אושרה כהתקבלה בסניף', 409);
  }
  if (row.closed_at) {
    throw httpError('ההזמנה כבר נאספה - אין צורך ב-SMS', 409);
  }

  let smsStatus;
  let smsError = null;
  if (!row.customer_phone) {
    smsStatus = 'no_phone';
  } else {
    const link = await buildPickupLink(env, row.order_number);
    const message = buildArrivalMessage(row.customer_name, row.order_number, row.branch_name, link);
    const result = await sendSms(env, row.customer_phone, message);
    smsStatus = result.ok ? 'sent' : 'failed';
    smsError = result.ok ? null : result.error;
    if (!result.ok) {
      console.error('pickup sms failed', row.order_number, result.error);
    }
  }

  await env.DB
    .prepare(
      `UPDATE pickup_notifications
       SET sms_status = ?, sms_error = ?, sms_attempts = sms_attempts + 1,
           sms_sent_at = CASE WHEN ? = 'sent' THEN datetime('now') ELSE sms_sent_at END
       WHERE order_number = ?`
    )
    .bind(smsStatus, smsError, smsStatus, row.order_number)
    .run();

  return smsStatus;
}

/**
 * רושם אצלנו שההזמנה נסגרה (נשלח "handover" למערכת האיסוף).
 * closedVia: 'customer' (לינק) או 'branch' (כפתור בסניף).
 */
export async function markClosed(db, orderNumber, closedVia) {
  await db
    .prepare(
      `UPDATE pickup_notifications SET closed_at = datetime('now'), closed_via = ?
       WHERE order_number = ? AND closed_at IS NULL`
    )
    .bind(closedVia, String(orderNumber))
    .run();
}

/**
 * מתרגם תשובת שגיאה ממערכת בחירת הסניף להודעה בעברית.
 */
function toFriendlyError(status, data) {
  if (status === 404) {
    return httpError('ההזמנה לא נמצאה. בדקי את המספר או סרקי שוב.', 404);
  }
  if (status === 422 && data.error === 'wrong_branch') {
    const error = httpError(`ההזמנה הזו שייכת לסניף ${data.correct_branch}, לא לסניף שלך.`, 422);
    error.correctBranch = data.correct_branch;
    return error;
  }
  if (status === 403) {
    return httpError('ההזמנה הזו לא שייכת לסניף שלך.', 403);
  }
  if (status === 409) {
    const currentStatus = data.order ? data.order.status : null;
    const label = STATUS_LABELS[currentStatus] || 'בסטטוס שלא מאפשר את הפעולה';
    return httpError(`לא ניתן לבצע: ההזמנה ${label}.`, 409);
  }
  return httpError('שגיאה במערכת האיסוף, נסי שוב', 502);
}

/**
 * הסניף מאשר שההזמנה הגיעה:
 * 1. מעדכנים את מערכת האיסוף (היא לא שולחת SMS כשהבקשה מגיעה מאיתנו)
 * 2. שומרים רשומה אצלנו
 * 3. שולחים ללקוחה SMS עם לינק לאישור איסוף
 * אם ה-SMS נכשל - הקבלה עדיין נשמרת, והסניף יכול לשלוח שוב.
 */
export async function receiveOrder(env, orderNumber, pickupBranchId, actorName) {
  const path = '/internal/orders/' + encodeURIComponent(orderNumber) + '/receive';
  const { status, data } = await callPickupApi(env, path, 'POST', {
    branch_id: pickupBranchId,
    received_by: actorName,
  });

  if (status !== 200) {
    throw toFriendlyError(status, data);
  }

  const savedOrderNumber = String(data.order_number || orderNumber);
  await env.DB
    .prepare(
      `INSERT INTO pickup_notifications
         (order_number, pickup_branch_id, branch_name, customer_name, customer_phone, received_by)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(order_number) DO UPDATE SET
         pickup_branch_id = excluded.pickup_branch_id,
         branch_name = excluded.branch_name,
         customer_name = excluded.customer_name,
         customer_phone = excluded.customer_phone,
         received_by = excluded.received_by,
         received_at = datetime('now'),
         closed_at = NULL,
         closed_via = NULL`
    )
    .bind(
      savedOrderNumber,
      pickupBranchId,
      data.branch_name || null,
      data.customer_name || null,
      data.customer_phone || null,
      actorName
    )
    .run();

  // SMS ללקוחה כבוי כרגע (החלטה 19.11) - יופעל בעתיד עם PICKUP_SMS_ENABLED = "1"
  let smsStatus = 'disabled';
  if (env.PICKUP_SMS_ENABLED === '1') {
    smsStatus = await sendArrivalSms(env, savedOrderNumber);
  } else {
    await env.DB
      .prepare("UPDATE pickup_notifications SET sms_status = 'disabled' WHERE order_number = ?")
      .bind(savedOrderNumber)
      .run();
  }

  return {
    success: true,
    order_number: savedOrderNumber,
    customer_name: data.customer_name,
    branch_name: data.branch_name,
    new_status: data.new_status,
    sms_status: smsStatus,
  };
}

/**
 * סוגר את ההזמנה במערכת האיסוף ("נמסרה ללקוחה" -> completed).
 * נקרא מהלינק של הלקוחה (closedVia='customer') או מכפתור בסניף (closedVia='branch').
 */
export async function handoverOrder(env, orderNumber, pickupBranchId, actorName, closedVia) {
  const path = '/internal/orders/' + encodeURIComponent(orderNumber) + '/handover';
  const { status, data } = await callPickupApi(env, path, 'POST', {
    branch_id: pickupBranchId,
    received_by: actorName,
  });

  // אם ההזמנה כבר נסגרה (למשל הלקוחה לחצה פעמיים) - זו לא שגיאה
  const alreadyClosed = status === 409 && data.order && data.order.status === 'completed';
  if (status !== 200 && !alreadyClosed) {
    throw toFriendlyError(status, data);
  }
  await markClosed(env.DB, orderNumber, closedVia || 'branch');
  return { success: true, order_number: orderNumber, new_status: 'completed', already_closed: alreadyClosed };
}
