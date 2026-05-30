// הצפנת סיסמאות עם Web Crypto (PBKDF2) - תחליף ל-bcrypt שלא רץ על Workers.
//
// bcrypt הוא מודול נייטיב של Node ולא עובד על Cloudflare Workers.
// במקומו אנחנו משתמשים ב-PBKDF2 דרך crypto.subtle - API סטנדרטי שקיים
// גם ב-Workers וגם ב-Node, אז אותו קוד מייצר ומאמת סיסמאות בשני המקומות.
//
// פורמט ה-hash שנשמר ב-DB:  pbkdf2$<iterations>$<salt_b64>$<hash_b64>

const ITERATIONS = 100_000;
const HASH_BITS = 256;
const SALT_BYTES = 16;

// המרת ArrayBuffer ל-base64
function bufToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

// המרת base64 ל-Uint8Array
function base64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// גוזר מפתח PBKDF2 מהסיסמה והמלח
async function deriveBits(password, salt, iterations) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    HASH_BITS
  );
}

/**
 * מצפין סיסמה. מחזיר מחרוזת לשמירה ב-DB.
 */
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const bits = await deriveBits(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${bufToBase64(salt.buffer)}$${bufToBase64(bits)}`;
}

/**
 * מאמת סיסמה מול hash שמור. מחזיר true/false.
 * משתמש בהשוואה בזמן קבוע כדי למנוע timing attacks.
 */
export async function verifyPassword(password, stored) {
  if (!stored || !stored.startsWith('pbkdf2$')) return false;
  const [, iterStr, saltB64, hashB64] = stored.split('$');
  const iterations = parseInt(iterStr, 10);
  const salt = base64ToBytes(saltB64);
  const expected = base64ToBytes(hashB64);
  const bits = new Uint8Array(await deriveBits(password, salt, iterations));

  if (bits.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < bits.length; i++) diff |= bits[i] ^ expected[i];
  return diff === 0;
}
