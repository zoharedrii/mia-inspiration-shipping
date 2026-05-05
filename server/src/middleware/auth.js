// Middleware לאימות בקשות
//
// requireAuth - דורש שיהיה משתמש מחובר (טוקן תקף)
// requireRole - דורש שלמשתמש יהיה תפקיד מסוים

import { verifyToken } from '../services/auth.js';

/**
 * מחלץ את הטוקן מ-header של "Authorization: Bearer xxx"
 */
function extractToken(req) {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

/**
 * Middleware שדורש משתמש מחובר.
 * אם הטוקן תקין - מוסיף את req.user ועובר הלאה.
 * אם לא - מחזיר 401.
 */
export function requireAuth(req, res, next) {
  try {
    const token = extractToken(req);
    const user = verifyToken(token);
    req.user = user;
    next();
  } catch (error) {
    res.status(error.statusCode || 401).json({
      error: error.message || 'נדרש אימות',
    });
  }
}

/**
 * Middleware שדורש תפקיד מסוים (או אחד מכמה).
 * שימוש: router.get('/admin-only', requireAuth, requireRole('admin'), handler)
 *        router.post('/manage', requireAuth, requireRole('admin', 'warehouse'), handler)
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'נדרש אימות' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'אין לך הרשאה לבצע פעולה זו',
        required_roles: allowedRoles,
        your_role: req.user.role,
      });
    }

    next();
  };
}
