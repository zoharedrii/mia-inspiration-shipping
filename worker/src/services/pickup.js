// שירות הזמנות איסוף - מדבר עם מערכת בחירת הסניף (branch-pickup-worker).
//
// מערכת בחירת הסניף היא "בעלת הבית" של הזמנות האיסוף: היא מקבלת אותן משופיפיי,
// שולחת SMS ללקוחה ומעדכנת את שופיפיי. אנחנו רק מציגים לסניף את ההזמנות
// ושולחים אליה "התקבל בסניף" / "נמסר ללקוחה".
//
// האימות בין המערכות: מפתח סודי משותף שנשלח ב-header בשם X-Internal-Key.
// משתני סביבה נדרשים:
//   PICKUP_API_URL - כתובת מערכת בחירת הסניף (לא סוד, מוגדר ב-wrangler.toml)
//   PICKUP_API_KEY - המפתח הסודי (סוד, מוגדר דרך wrangler secret put)

import { httpError } from '../lib/http.js';

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
  return data.orders || [];
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
 * הסניף מאשר שההזמנה הגיעה. מערכת האיסוף שולחת ללקוחה SMS עם לינק לאישור איסוף.
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
  return data;
}

/**
 * הסניף מסמן שההזמנה נמסרה ללקוחה (למקרה שהלקוחה לא לחצה על הלינק).
 */
export async function handoverOrder(env, orderNumber, pickupBranchId, actorName) {
  const path = '/internal/orders/' + encodeURIComponent(orderNumber) + '/handover';
  const { status, data } = await callPickupApi(env, path, 'POST', {
    branch_id: pickupBranchId,
    received_by: actorName,
  });

  if (status !== 200) {
    throw toFriendlyError(status, data);
  }
  return data;
}
