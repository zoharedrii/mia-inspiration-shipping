// שירות אימות - login, יצירה ואימות של JWT
//
// JWT (JSON Web Token) הוא סטנדרט לטוקן חתום שהשרת נותן ללקוח.
// הלקוח שולח אותו בכל בקשה והשרת מאמת שהוא תקין ולא שונה.

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { findByUsername, findById, sanitize } from './users.js';

const JWT_EXPIRES_IN = '8h'; // טוקן בתוקף יום עבודה

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === 'development-only-replace-in-production') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET חייב להיות מוגדר ייחודי בפרודקשן!');
    }
    // בפיתוח - שימוש בערך הדיפולטיבי בסדר
  }
  return secret;
}

/**
 * מנסה להתחבר עם שם משתמש וסיסמה.
 * אם הצליח - מחזיר { user, token }.
 * אם לא - זורק שגיאה עם הודעה ידידותית (בלי לחשוף איזה שדה לא נכון).
 */
export async function login(username, password) {
  if (!username || !password) {
    throw Object.assign(new Error('יש להזין שם משתמש וסיסמה'), { statusCode: 400 });
  }

  const user = findByUsername(username);

  // הערה אבטחה: גם אם המשתמש לא קיים, אנחנו עדיין מבצעים bcrypt.compare
  // עם hash מזויף, כדי שזמן התגובה יהיה זהה ולא יחשוף האם המשתמש קיים.
  const fakeHash = '$2b$10$0000000000000000000000000000000000000000000000000000';
  const passwordValid = await bcrypt.compare(password, user?.password_hash || fakeHash);

  if (!user || !passwordValid) {
    throw Object.assign(new Error('שם משתמש או סיסמה שגויים'), { statusCode: 401 });
  }

  // יוצרים JWT עם פרטים מינימליים (לא כולל סיסמה!)
  const token = jwt.sign(
    {
      sub: user.id,
      username: user.username,
      role: user.role,
      branch_id: user.branch_id,
    },
    getJwtSecret(),
    { expiresIn: JWT_EXPIRES_IN }
  );

  return {
    token,
    user: sanitize(findById(user.id)), // מחזירים פרטים מלאים עם שם הסניף
  };
}

/**
 * מאמת JWT ומחזיר את המשתמש המלא מה-DB.
 * אם הטוקן לא תקין/פג תוקף - זורק שגיאה.
 */
export function verifyToken(token) {
  if (!token) {
    throw Object.assign(new Error('חסר טוקן אימות'), { statusCode: 401 });
  }

  let payload;
  try {
    payload = jwt.verify(token, getJwtSecret());
  } catch (error) {
    const message = error.name === 'TokenExpiredError' ? 'הטוקן פג תוקף' : 'טוקן לא תקין';
    throw Object.assign(new Error(message), { statusCode: 401 });
  }

  // טוענים את המשתמש מ-DB - מוודאים שהוא עדיין פעיל
  const user = findById(payload.sub);
  if (!user || !user.is_active) {
    throw Object.assign(new Error('משתמש לא קיים או לא פעיל'), { statusCode: 401 });
  }

  return user;
}
