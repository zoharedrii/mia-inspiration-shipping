// אימות מול אוריין - Login + ניהול AuthToken + Session Cookie.
//
// פרודקשן: Login מחזיר { AuthToken: "..." } — JWT בתוקף שעה.
// סביבת טסט (Test/Ts123456): Login מחזיר "Authorized" + Set-Cookie session.
//   במצב זה שולחים בקריאות API: Authorization: Basic ... + Cookie: <session>

let cachedToken = null;      // JWT (פרודקשן) או "Basic ..." (טסט)
let cachedCookie = null;     // Session Cookie מ-Login (טסט בלבד, אך שמור תמיד)
let tokenExpiry = null;

// תוקף אמיתי שעה - שומרים 55 דקות לבטחון מפני clock-skew
const TOKEN_TTL_MS = 55 * 60 * 1000;

/**
 * מתחבר לאוריין עם שם משתמש וסיסמה (מ-env) ומחזיר AuthToken חדש.
 * שומר גם Set-Cookie מה-Login לשימוש בקריאות הבאות.
 * @returns {Promise<string>}
 */
export async function login(env) {
  const username = env.ORIAN_USERNAME;
  const password = env.ORIAN_PASSWORD;

  if (!username || !password) {
    throw new Error('חסרים פרטי גישה לאוריין: ORIAN_USERNAME ו/או ORIAN_PASSWORD לא הוגדרו');
  }

  // אוריין דורשת Basic Auth - שם משתמש וסיסמה ב-Base64
  const credentials = btoa(`${username}:${password}`);

  const response = await fetch(`${env.ORIAN_BASE_URL}/Login`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  if (!response.ok) {
    throw new Error(`התחברות לאוריין נכשלה (HTTP ${response.status})`);
  }

  // שמירת Session Cookie מ-Login — ייתכן שנדרש בקריאות הבאות
  const setCookieHeader = response.headers.get('set-cookie');
  if (setCookieHeader) {
    // לוקחים רק את חלק ה-NAME=VALUE (לפני הפסיק/semicolon הראשון)
    cachedCookie = setCookieHeader.split(';')[0].trim();
    console.log(`🍪 [Orian] Session Cookie נשמר מ-Login: ${cachedCookie.split('=')[0]}=***`);
  }

  // פרודקשן: { AuthToken: "..." } | טסט: "Authorized"
  const data = await response.json();
  let token = data?.AuthToken;

  if (!token) {
    if (data === 'Authorized') {
      // סביבת טסט: ה-Login מחזיר "Authorized" + Cookie Session.
      // שומרים Basic credentials כטוקן — ישלחו כ-Authorization: Basic ...
      token = `Basic ${credentials}`;
      console.log('ℹ️  [Orian] סביבת טסט — Authorization: Basic + Cookie Session');
    } else {
      throw new Error(`התחברות לאוריין הצליחה אך לא התקבל AuthToken. תגובה: ${JSON.stringify(data)}`);
    }
  }

  cachedToken = token;
  tokenExpiry = Date.now() + TOKEN_TTL_MS;

  console.log('🔑 [Orian] Login הצליח (תוקף 55 דקות)');
  return token;
}

/**
 * מחזיר AuthToken תקף (מהזיכרון אם עדיין בתוקף, אחרת מתחבר מחדש).
 */
export async function getToken(env) {
  const isValid = cachedToken && tokenExpiry && tokenExpiry > Date.now();
  if (isValid) {
    return cachedToken;
  }
  return login(env);
}

/**
 * מחזיר את ה-Session Cookie השמור (אם יש).
 * משמש ב-transportation.js לצירוף Cookie לקריאות API.
 */
export function getSessionCookie() {
  return cachedCookie;
}

/**
 * מתנתק מאוריין ומאפס את הטוקן השמור (אופציונלי).
 */
export async function logout(env) {
  if (!cachedToken) return;

  try {
    const authHeader = cachedToken.startsWith('Basic ')
      ? { Authorization: cachedToken }
      : { AuthToken: cachedToken };
    if (cachedCookie) authHeader.Cookie = cachedCookie;

    await fetch(`${env.ORIAN_BASE_URL}/Logout`, {
      method: 'POST',
      headers: authHeader,
    });
    console.log('🚪 [Orian] התנתקנו בהצלחה');
  } catch (error) {
    console.warn('⚠️  [Orian] שגיאה ב-logout (לא קריטי):', error.message);
  } finally {
    cachedToken = null;
    cachedCookie = null;
    tokenExpiry = null;
  }
}

/**
 * האם יש Token תקף בזיכרון? (לבדיקות בלבד)
 */
export function hasValidToken() {
  return Boolean(cachedToken && tokenExpiry && tokenExpiry > Date.now());
}
