// Middleware לאימות בקשות ב-Hono.
//
// requireAuth - דורש שיהיה משתמש מחובר (טוקן תקף). שומר את המשתמש ב-c.set('user').
// requireRole - דורש שלמשתמש יהיה תפקיד מסוים.
//
// ב-Express היה req.user; ב-Hono משתמשים ב-c.get('user') / c.set('user').

import { verifyToken } from '../services/auth.js';

/**
 * מחלץ את הטוקן מ-header של "Authorization: Bearer xxx"
 */
function extractToken(c) {
  const authHeader = c.req.header('Authorization') || '';
  const [scheme, token] = authHeader.split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

/**
 * Middleware שדורש משתמש מחובר.
 * אם הטוקן תקין - מוסיף את c.get('user') ועובר הלאה. אחרת - 401.
 */
export async function requireAuth(c, next) {
  try {
    const token = extractToken(c);
    const user = await verifyToken(c.env.DB, c.env, token);
    c.set('user', user);
    await next();
  } catch (error) {
    return c.json({ error: error.message || 'נדרש אימות' }, error.statusCode || 401);
  }
}

/**
 * Middleware שדורש תפקיד מסוים (או אחד מכמה).
 * שימוש: router.get('/x', requireAuth, requireRole('admin'), handler)
 */
export function requireRole(...allowedRoles) {
  return async (c, next) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'נדרש אימות' }, 401);
    }
    if (!allowedRoles.includes(user.role)) {
      return c.json(
        {
          error: 'אין לך הרשאה לבצע פעולה זו',
          required_roles: allowedRoles,
          your_role: user.role,
        },
        403
      );
    }
    await next();
  };
}
