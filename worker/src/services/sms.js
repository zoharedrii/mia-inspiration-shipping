// שליחת SMS דרך Flashy - אותו ספק שמערכת האיסוף משתמשת בו.
//
// משתנה סביבה נדרש:
//   FLASHY_API_KEY - סוד, מוגדר דרך `wrangler secret put FLASHY_API_KEY`
//
// מחזיר { ok: true } או { ok: false, error: '...' } - לא זורק שגיאה,
// כדי שכשל ב-SMS לא יבטל את אישור הקבלה בסניף.

const FLASHY_SMS_URL = 'https://api.flashy.app/sms/send';

export async function sendSms(env, to, message) {
  if (!env.FLASHY_API_KEY) {
    return { ok: false, error: 'no_api_key' };
  }
  if (!to) {
    return { ok: false, error: 'no_phone' };
  }

  let response;
  try {
    response = await fetch(FLASHY_SMS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.FLASHY_API_KEY}`,
      },
      body: JSON.stringify({ to: to, message: message, sender_name: 'Mia' }),
    });
  } catch (error) {
    return { ok: false, error: 'network: ' + error.message };
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    return { ok: false, error: `flashy ${response.status}: ${text.slice(0, 200)}` };
  }
  return { ok: true };
}
