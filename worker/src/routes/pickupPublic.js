// דף ציבורי ללקוחה: אישור איסוף הזמנה מהסניף.
// הלקוחה מגיעה לכאן מהלינק ב-SMS: /p/<מספר הזמנה>.<חתימה>
// אין התחברות - החתימה בלינק היא ההוכחה שהלינק נשלח אליה (ראו services/pickupLink.js).
//
// GET  /p/:token - דף עם כפתור "אספתי את ההזמנה"
// POST /p/:token - הלקוחה לחצה: סוגרים את ההזמנה במערכת האיסוף
//
// לחיצה היא POST ולא קישור, כדי שתצוגה מקדימה של הלינק (בוואטסאפ למשל)
// לא תסגור את ההזמנה בטעות.

import { Hono } from 'hono';
import * as pickup from '../services/pickup.js';
import { verifyPickupToken } from '../services/pickupLink.js';

const router = new Hono();

// מונע הזרקת HTML דרך שם לקוחה / סניף
function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderPage(title, bodyHtml) {
  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)} | Mia Inspiration</title>
<style>
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; background: #faf7f4; color: #222; }
  .card { max-width: 420px; margin: 40px auto; background: #fff; border-radius: 14px;
          padding: 28px 22px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); text-align: center; }
  h1 { font-size: 22px; margin: 0 0 12px; }
  p { font-size: 17px; line-height: 1.5; margin: 8px 0; }
  .brand { font-size: 14px; color: #888; margin-top: 24px; }
  button { width: 100%; margin-top: 20px; padding: 16px; font-size: 19px; border: 0;
           border-radius: 10px; background: #222; color: #fff; cursor: pointer; }
  .ok { color: #1a7f37; font-size: 46px; }
</style>
</head>
<body>
<div class="card">
${bodyHtml}
<div class="brand">Mia Inspiration</div>
</div>
</body>
</html>`;
}

function invalidLinkPage(c) {
  const html = renderPage('לינק לא תקין', `
    <h1>הלינק לא תקין</h1>
    <p>ייתכן שהוא הועתק חלקית. אפשר לפנות לסניף ונשמח לעזור.</p>`);
  return c.html(html, 404);
}

function collectedPage(c, orderNumber) {
  const html = renderPage('ההזמנה נאספה', `
    <div class="ok">✓</div>
    <h1>תודה! ההזמנה נאספה</h1>
    <p>הזמנה #${escapeHtml(orderNumber)} סומנה כנאספה.</p>
    <p>מקוות שתיהני ממנה 💛</p>`);
  return c.html(html);
}

router.get('/:token', async (c) => {
  const orderNumber = await verifyPickupToken(c.env, c.req.param('token'));
  if (!orderNumber) {
    return invalidLinkPage(c);
  }
  const row = await pickup.getNotification(c.env.DB, orderNumber);
  if (!row) {
    return invalidLinkPage(c);
  }
  if (row.closed_at) {
    return collectedPage(c, orderNumber);
  }

  const firstName = String(row.customer_name || '').split(' ')[0];
  const html = renderPage('אישור איסוף', `
    <h1>היי ${escapeHtml(firstName)} 🛍️</h1>
    <p>ההזמנה שלך <b>#${escapeHtml(orderNumber)}</b> מחכה לך בסניף <b>${escapeHtml(row.branch_name)}</b>.</p>
    <p>אחרי שאספת, לחצי על הכפתור:</p>
    <form method="post">
      <button type="submit">אספתי את ההזמנה</button>
    </form>`);
  return c.html(html);
});

router.post('/:token', async (c) => {
  const orderNumber = await verifyPickupToken(c.env, c.req.param('token'));
  if (!orderNumber) {
    return invalidLinkPage(c);
  }
  const row = await pickup.getNotification(c.env.DB, orderNumber);
  if (!row) {
    return invalidLinkPage(c);
  }
  if (row.closed_at) {
    return collectedPage(c, orderNumber);
  }

  try {
    await pickup.handoverOrder(c.env, orderNumber, row.pickup_branch_id, 'הלקוחה (לינק)', 'customer');
  } catch (error) {
    console.error('pickup customer confirm failed', orderNumber, error.message);
    const html = renderPage('לא הצלחנו לעדכן', `
      <h1>אופס, לא הצלחנו לעדכן</h1>
      <p>נסי שוב בעוד רגע, או ספרי לצוות בסניף שאספת.</p>
      <form method="post"><button type="submit">לנסות שוב</button></form>`);
    return c.html(html, 502);
  }
  return collectedPage(c, orderNumber);
});

export default router;
