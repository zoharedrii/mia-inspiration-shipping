// סריקת חבילות לאיסוף מסניף.
//
// החבילות של הלקוחות מנוהלות במערכת נפרדת — "איסוף מסניף" (branch-pickup).
// כאן אנחנו רק מעבירים אליה את הסריקה: מספר ההזמנה, הסניף של הסטייליסטית
// (המספר שלו במערכת האיסוף) והשם שלה.
// מערכת האיסוף עושה את כל השאר: משנה סטטוס ל"מחכה לאיסוף", שולחת SMS ללקוחה
// בפלאשי, כותבת הערה בשופיפיי ומזהה סריקה בסניף הלא נכון.
//
// משתני סביבה:
//   PICKUP_API_URL      — כתובת מערכת האיסוף (ב-wrangler.toml, לא סוד)
//   PICKUP_INTERNAL_KEY — מפתח פנימי משותף לשתי המערכות (סוד, wrangler secret put)

import { httpError } from '../lib/http.js';

/**
 * מנקה את מה שהסורק קרא. ה-QR מכיל את מספר ההזמנה בלי "#" (למשל "15234"),
 * וכך הוא שמור גם במערכת האיסוף. אם הוקלד ידנית עם "#" — מורידים אותו.
 */
function normalizeOrderNumber(raw) {
  return String(raw || '').trim().replace(/^#/, '');
}

/**
 * מעביר סריקה של חבילה למערכת האיסוף ומחזיר תשובה מוכנה למסך.
 *
 * @param {D1Database} db
 * @param {object} env
 * @param {object} user - המשתמשת המחוברת (מ-requireAuth)
 * @param {string} rawOrderNumber - מה שנסרק או הוקלד
 * @returns {Promise<{ok: boolean, code: string, message: string, order_number: string, customer_name?: string, correct_branch?: string}>}
 */
export async function scanPickupOrder(db, env, user, rawOrderNumber) {
  const orderNumber = normalizeOrderNumber(rawOrderNumber);
  if (!orderNumber) {
    throw httpError('לא נסרק מספר הזמנה', 400);
  }

  if (!env.PICKUP_API_URL || !env.PICKUP_INTERNAL_KEY) {
    throw httpError('החיבור למערכת האיסוף לא מוגדר', 500);
  }

  // מוצאים את הסניף של המשתמשת ואת המספר שלו במערכת האיסוף
  const branch = await db
    .prepare('SELECT name, pickup_branch_id FROM branches WHERE id = ?')
    .bind(user.branch_id)
    .first();
  if (!branch || !branch.pickup_branch_id) {
    throw httpError('הסניף שלך לא מחובר למערכת האיסוף', 400);
  }

  // שולחים למערכת האיסוף
  let response;
  try {
    response = await fetch(
      `${env.PICKUP_API_URL}/internal/branch-scan/${encodeURIComponent(orderNumber)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Key': env.PICKUP_INTERNAL_KEY,
        },
        body: JSON.stringify({
          branch_id: branch.pickup_branch_id,
          scanned_by: user.full_name,
        }),
      }
    );
  } catch (error) {
    console.error('❌ [Pickup] מערכת האיסוף לא זמינה:', error.message);
    throw httpError('מערכת האיסוף לא זמינה כרגע, נסי שוב בעוד דקה', 502);
  }

  const data = await response.json().catch(() => ({}));

  // מתרגמים את התשובה של מערכת האיסוף להודעה בעברית למסך
  if (response.ok && data.success) {
    return {
      ok: true,
      code: 'arrived',
      message: 'התקבלה בסניף — נשלחה ללקוחה הודעה שהחבילה מחכה לה',
      order_number: orderNumber,
      customer_name: data.customer_name || '',
    };
  }

  if (response.status === 422 && data.error === 'wrong_branch') {
    return {
      ok: false,
      code: 'wrong_branch',
      message: `החבילה שייכת לסניף ${data.correct_branch}, לא לסניף הזה`,
      order_number: orderNumber,
      correct_branch: data.correct_branch,
    };
  }

  if (response.status === 404) {
    return {
      ok: false,
      code: 'not_found',
      message: 'לא נמצאה הזמנה לאיסוף עם המספר הזה',
      order_number: orderNumber,
    };
  }

  if (response.status === 409) {
    // ההזמנה כבר נסרקה, או שעוד לא יצאה מהמחסן
    const status = data.order?.status;
    const messages = {
      pending: 'החבילה עוד לא נסרקה ביציאה מהמחסן',
      waiting_pickup: 'החבילה כבר נסרקה — היא מחכה ללקוחה',
      completed: 'החבילה כבר נמסרה ללקוחה',
      wrong_branch: 'החבילה סומנה כ"הגיעה לסניף הלא נכון" — צריך לטפל בה מול המחסן',
    };
    return {
      ok: false,
      code: 'wrong_status',
      message: messages[status] || 'לא ניתן לסרוק את החבילה במצב הנוכחי שלה',
      order_number: orderNumber,
      customer_name: data.order?.customer_name || '',
    };
  }

  console.error('❌ [Pickup] תשובה לא צפויה ממערכת האיסוף:', response.status, JSON.stringify(data));
  throw httpError('שגיאה במערכת האיסוף, נסי שוב', 502);
}
