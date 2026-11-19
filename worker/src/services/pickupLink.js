// לינק חתום ללקוחה לאישור איסוף: /p/<מספר הזמנה>.<חתימה>
//
// החתימה היא HMAC-SHA256 של מספר ההזמנה (12 תווי hex ראשונים), כך שאי אפשר
// לנחש לינק של הזמנה אחרת, והלקוחה לא צריכה להקליד טלפון.
//
// משתני סביבה:
//   PICKUP_LINK_SECRET - סוד, מוגדר דרך `wrangler secret put PICKUP_LINK_SECRET`
//   PUBLIC_API_URL     - הכתובת הציבורית של ה-Worker (wrangler.toml)

const SIGNATURE_LENGTH = 12;

async function hmacHex(secret, value) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// השוואה בזמן קבוע - לא מדליפה כמה תווים נכונים
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function signOrderNumber(env, orderNumber) {
  if (!env.PICKUP_LINK_SECRET) {
    throw new Error('PICKUP_LINK_SECRET is not set');
  }
  const full = await hmacHex(env.PICKUP_LINK_SECRET, String(orderNumber));
  return full.slice(0, SIGNATURE_LENGTH);
}

export async function buildPickupLink(env, orderNumber) {
  const base = String(env.PUBLIC_API_URL || '').replace(/\/$/, '');
  const signature = await signOrderNumber(env, orderNumber);
  return `${base}/p/${encodeURIComponent(orderNumber)}.${signature}`;
}

/**
 * מקבל את החלק שאחרי /p/ ומחזיר את מספר ההזמנה אם החתימה תקינה, אחרת null.
 */
export async function verifyPickupToken(env, token) {
  if (!env.PICKUP_LINK_SECRET) return null;
  const decoded = decodeURIComponent(String(token || ''));
  const dot = decoded.lastIndexOf('.');
  if (dot <= 0) return null;

  const orderNumber = decoded.slice(0, dot);
  const signature = decoded.slice(dot + 1).toLowerCase();
  if (!/^[0-9a-f]+$/.test(signature)) return null;

  const expected = await signOrderNumber(env, orderNumber);
  return safeEqual(signature, expected) ? orderNumber : null;
}
