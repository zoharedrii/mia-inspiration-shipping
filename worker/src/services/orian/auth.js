// אימות מול אוריין - Login + ניהול AuthToken.
//
// אוריין נותנת AuthToken בתוקף לשעה. במקום להתחבר מחדש בכל קריאה, שומרים את
// הטוקן בזיכרון ה-isolate ומחדשים רק כשפג תוקפו. (ב-axios היה אותו רעיון;
// כאן עברנו ל-fetch ול-btoa במקום Buffer, כי זה מה שקיים על Workers.)

let cachedToken = null;
let tokenExpiry = null;

// תוקף אמיתי שעה - שומרים 55 דקות לבטחון מפני clock-skew
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

  // אוריין דורשת Basic Auth - שם משתמש וסיסמה ב-Base64 (btoa = תחליף ל-Buffer)
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

  // אוריין מחזירה JSON בצורה: { AuthToken: "..." }
  // בסביבת הטסט עם פרטי Test/Ts123456 מגיע "Authorized" בלי טוקן —
  // במקרה זה נשתמש ב-Basic Auth כ"טוקן" לקריאות API (עובד בסביבת הטסט)
  const data = await response.json();
  let token = data?.AuthToken;

  if (!token) {
    if (data === 'Authorized') {
      // סביבת טסט: ה-Login מחזיר את המחרוזת "Authorized" במקום JWT אמיתי.
      // הטוקן שנשלח ב-AuthToken header לשאר הקריאות הוא "Authorized" עצמו.
      token = 'Authorized';
      console.log('ℹ️  [Orian] סביבת טסט - AuthToken="Authorized" (לפי תגובת Login)');
    } else {
      throw new Error(`התחברות לאוריין הצליחה אך לא התקבל AuthToken. תגובה: ${JSON.stringify(data)}`);
    }
  }

  cachedToken = token;
  tokenExpiry = Date.now() + TOKEN_TTL_MS;

  console.log('🔑 [Orian] התקבל AuthToken חדש (תוקף 55 דקות)');
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
    // שולחים את ה-header המתאים לסוג הטוקן (Basic לטסט, AuthToken לפרודקשן)
    const authHeader = cachedToken.startsWith('Basic ')
      ? { Authorization: cachedToken }
      : { AuthToken: cachedToken };
    await fetch(`${env.ORIAN_BASE_URL}/Logout`, {
      method: 'POST',
      headers: authHeader,
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
 * האם יש Token תקף בזיכרון? (לבדיקות בלבד)
 */
export function hasValidToken() {
  return Boolean(cachedToken && tokenExpiry && tokenExpiry > Date.now());
}
