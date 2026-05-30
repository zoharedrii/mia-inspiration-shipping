// Routes לאימות משתמשים.
//
// POST /api/auth/login           - התחברות עם שם משתמש וסיסמה
// GET  /api/auth/me              - פרטי המשתמש המחובר (לפי הטוקן)
// POST /api/auth/forgot-password - בקשת איפוס סיסמה

import { Hono } from 'hono';
import { login } from '../services/auth.js';
import { requestPasswordReset } from '../services/users.js';
import { requireAuth } from '../middleware/auth.js';

const router = new Hono();

/**
 * POST /api/auth/login
 * Body: { username, password }  →  Response: { user, token }
 */
router.post('/login', async (c) => {
  try {
    const { username, password } = await c.req.json().catch(() => ({}));
    const result = await login(c.env.DB, c.env, username, password);
    return c.json(result);
  } catch (error) {
    return c.json({ error: error.message || 'שגיאת התחברות' }, error.statusCode || 500);
  }
});

/**
 * GET /api/auth/me
 * Headers: Authorization: Bearer <token>  →  Response: { user }
 */
router.get('/me', requireAuth, (c) => {
  return c.json({ user: c.get('user') });
});

/**
 * POST /api/auth/forgot-password
 * Body: { username }. מסיבות אבטחה: התשובה זהה גם אם המשתמש לא קיים.
 */
router.post('/forgot-password', async (c) => {
  try {
    const { username } = await c.req.json().catch(() => ({}));
    const result = await requestPasswordReset(c.env.DB, username);
    return c.json(result);
  } catch (error) {
    return c.json({ error: error.message }, error.statusCode || 500);
  }
});

export default router;
