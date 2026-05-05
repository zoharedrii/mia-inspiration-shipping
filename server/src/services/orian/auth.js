// אימות מול אוריין - Login + ניהול AuthToken
//
// אוריין נותנת AuthToken בתוקף לשעה אחת. במקום להתחבר מחדש בכל קריאה,
// אנחנו שומרים את הטוקן בזיכרון השרת ומחדשים רק כשפג תוקפו.

import orianClient from './client.js';

// משתני מצב מקומיים - זיכרון ה-Token
let cachedToken = null;
let tokenExpiry = null;

// תוקף האמיתי הוא שעה - אנחנו שומרים 55 דקות לבטחון, ליתר ביטחון מפני clock-skew
const TOKEN_TTL_MS = 55 * 60 * 1000;

/**
 * מתחבר לאוריין עם שם משתמש וסיסמה (מ-.env)
 * ומחזיר AuthToken חדש.
 *
 * @returns {Promise<string>} ה-AuthToken
 */
export async function login() {
  const username = process.env.ORIAN_USERNAME;
  const password = process.env.ORIAN_PASSWORD;

  if (!username || !password) {
    throw new Error(
      'חסרים פרטי גישה לאוריין: ORIAN_USERNAME ו/או ORIAN_PASSWORD לא הוגדרו ב-.env'
    );
  }

  // אוריין דורשת Basic Auth - שם משתמש וסיסמה ב-Base64
  const credentials = Buffer.from(`${username}:${password}`).toString('base64');

  const response = await orianClient.post('/Login', null, {
    headers: {
      Authorization: `Basic ${credentials}`,
    },
  });

  // אוריין מחזירה JSON בצורה: { AuthToken: "..." }
  const token = response.data?.AuthToken;
  if (!token) {
    throw new Error(
      `התחברות לאוריין הצליחה אך לא התקבל AuthToken. תגובה: ${JSON.stringify(response.data)}`
    );
  }

  cachedToken = token;
  tokenExpiry = Date.now() + TOKEN_TTL_MS;

  console.log('🔑 [Orian] התקבל AuthToken חדש (תוקף 55 דקות)');
  return token;
}

/**
 * מחזיר AuthToken תקף.
 * אם יש אחד בזיכרון ועדיין תקף - מחזיר אותו.
 * אחרת - מתחבר מחדש ומחזיר חדש.
 */
export async function getToken() {
  const isValid = cachedToken && tokenExpiry && tokenExpiry > Date.now();
  if (isValid) {
    return cachedToken;
  }
  return await login();
}

/**
 * מתנתק מאוריין ומאפס את הטוקן השמור.
 * אופציונלי - הטוקן יפוג גם בלי זה תוך שעה.
 */
export async function logout() {
  if (!cachedToken) return;

  try {
    await orianClient.post('/Logout', null, {
      headers: { AuthToken: cachedToken },
    });
    console.log('🚪 [Orian] התנתקנו בהצלחה');
  } catch (error) {
    // אם ה-logout נכשל, לא משנה - אנחנו מאפסים בכל מקרה
    console.warn('⚠️  [Orian] שגיאה ב-logout (לא קריטי):', error.message);
  } finally {
    cachedToken = null;
    tokenExpiry = null;
  }
}

/**
 * האם יש Token תקף בזיכרון? (לבדיקות בלבד, לא לשימוש בפועל)
 */
export function hasValidToken() {
  return Boolean(cachedToken && tokenExpiry && tokenExpiry > Date.now());
}
