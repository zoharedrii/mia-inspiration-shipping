// אימות מול אוריין - Login + ניהול AuthToken.
//
// חשוב: אוריין מחזירה את ה-AuthToken ב-HEADER בשם "authtoken" (לא ב-body!).
// ה-body של Login מכיל רק "Authorized" — זו הודעת אישור, לא הטוקן.
// הטוקן הוא GUID (למשל "959b87f8-5dd3-469c-a9d8-d4a30de4a92e") שנשלח
// בקריאות הבאות ב-header "AuthToken". זהה לסביבת טסט ולסביבת פרודקשן.

let cachedToken = null;
let tokenExpiry = null;

// תוקף - שומרים 55 דקות לבטחון מפני clock-skew
const TOKEN_TTL_MS = 55 * 60 * 1000;

/**
 * מתחבר לאוריין עם שם משתמש וסיסמה (מ-env) ומחזיר AuthToken חדש.
 * @returns {Promise<string>}
 */
export async function login(env) {
  const username = env.ORIAN_USERNAME;
  const password = env.ORIAN_PASSWORD;

  if (!username || !password) {
    throw new Error('חסרים פרטי גישה לאוריין: ORIAN_USERNAME ו/או ORIAN_PASSWORD לא הוגדרו');
  }

  // אוריין דורשת Basic Auth ל-Login - שם משתמש וסיסמה ב-Base64
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

  // ה-AuthToken מגיע ב-header "authtoken" (ה-body הוא רק "Authorized")
  let token = response.headers.get('authtoken');

  // נפילה לאחור: אם בעתיד יוחזר ב-body כ-{ AuthToken: "..." }
  if (!token) {
    const data = await response.json().catch(() => null);
    token = data?.AuthToken;
  }

  if (!token) {
    throw new Error('התחברות לאוריין הצליחה אך לא התקבל AuthToken (header "authtoken" חסר)');
  }

  cachedToken = token;
  tokenExpiry = Date.now() + TOKEN_TTL_MS;

  console.log('🔑 [Orian] AuthToken התקבל מ-header (תוקף 55 דקות)');
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
 * מתנתק מאוריין ומאפס את הטוקן השמור (אופציונלי).
 */
export async function logout(env) {
  if (!cachedToken) return;

  try {
    await fetch(`${env.ORIAN_BASE_URL}/Logout`, {
      method: 'POST',
      headers: { AuthToken: cachedToken },
    });
    console.log('🚪 [Orian] התנתקנו בהצלחה');
  } catch (error) {
    console.warn('⚠️  [Orian] שגיאה ב-logout (לא קריטי):', error.message);
  } finally {
    cachedToken = null;
    tokenExpiry = null;
  }
}

/**
 * מאפס את ה-token השמור *מקומית* בלבד (בלי לקרוא ל-Logout של אוריין).
 * נחוץ כשאוריין מחזירה HTTP 401 — סימן שה-token שלנו נפסל בצד אוריין
 * עוד לפני תום ה-cache המקומי (55 דק'), כדי לאלץ login חדש בניסיון הבא.
 */
export function clearToken() {
  cachedToken = null;
  tokenExpiry = null;
}

/**
 * האם יש Token תקף בזיכרון? (לבדיקות בלבד)
 */
export function hasValidToken() {
  return Boolean(cachedToken && tokenExpiry && tokenExpiry > Date.now());
}
