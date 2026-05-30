// שירות אימות - login, יצירה ואימות של JWT.
//
// JWT (JSON Web Token) הוא טוקן חתום שהשרת נותן ללקוח אחרי התחברות.
// כאן משתמשים ב-hono/jwt (תחליף ל-jsonwebtoken שלא רץ על Workers) -
// אותו אלגוריתם HS256, רק API אסינכרוני.

import { sign, verify } from 'hono/jwt';
import { verifyPassword } from '../lib/password.js';
import { findByUsername, findById, sanitize } from './users.js';
import { httpError } from '../lib/http.js';

const JWT_EXPIRES_SECONDS = 8 * 60 * 60; // טוקן בתוקף יום עבודה (8 שעות)

// hash מזויף בפורמט PBKDF2 - להשוואה בזמן קבוע כשהמשתמש לא קיים (מונע timing attack)
const FAKE_HASH = `pbkdf2$100000$${'A'.repeat(22)}==$${'A'.repeat(43)}=`;

function getJwtSecret(env) {
  const secret = env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET חייב להיות מוגדר (wrangler secret put JWT_SECRET)');
  }
  return secret;
}

/**
 * מנסה להתחבר עם שם משתמש וסיסמה.
 * אם הצליח - מחזיר { user, token }.
 * אם לא - זורק שגיאה עם הודעה ידידותית (בלי לחשוף איזה שדה לא נכון).
 */
export async function login(db, env, username, password) {
  if (!username || !password) {
    throw httpError('יש להזין שם משתמש וסיסמה', 400);
  }

  const user = await findByUsername(db, username);

  // גם אם המשתמש לא קיים, עדיין מבצעים verifyPassword עם hash מזויף
  // כדי שזמן התגובה יהיה זהה ולא יחשוף האם המשתמש קיים.
  const passwordValid = await verifyPassword(password, user?.password_hash || FAKE_HASH);

  if (!user || !passwordValid) {
    throw httpError('שם משתמש או סיסמה שגויים', 401);
  }

  // יוצרים JWT עם פרטים מינימליים (לא כולל סיסמה!)
  const now = Math.floor(Date.now() / 1000);
  const token = await sign(
    {
      sub: user.id,
      username: user.username,
      role: user.role,
      branch_id: user.branch_id,
      exp: now + JWT_EXPIRES_SECONDS,
    },
    getJwtSecret(env)
  );

  return {
    token,
    user: sanitize(await findById(db, user.id)), // מחזירים פרטים מלאים עם שם הסניף
  };
}

/**
 * מאמת JWT ומחזיר את המשתמש המלא מה-DB.
 * אם הטוקן לא תקין/פג תוקף - זורק שגיאה.
 */
export async function verifyToken(db, env, token) {
  if (!token) {
    throw httpError('חסר טוקן אימות', 401);
  }

  let payload;
  try {
    // הגרסה הזו של hono/jwt דורשת לציין במפורש את האלגוריתם (HS256) ב-verify
    payload = await verify(token, getJwtSecret(env), 'HS256');
  } catch (error) {
    throw httpError('טוקן לא תקין או פג תוקף', 401);
  }

  // טוענים את המשתמש מ-DB - מוודאים שהוא עדיין פעיל
  const user = await findById(db, payload.sub);
  if (!user || !user.is_active) {
    throw httpError('משתמש לא קיים או לא פעיל', 401);
  }

  return user;
}
