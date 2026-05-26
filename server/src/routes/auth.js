// Routes לאימות משתמשים
//
// POST /api/auth/login - התחברות עם שם משתמש וסיסמה
// GET  /api/auth/me    - מחזיר את פרטי המשתמש המחובר (לפי הטוקן)

import { Router } from 'express';
import { login } from '../services/auth.js';
import { requestPasswordReset } from '../services/users.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/auth/login
 * Body: { username, password }
 * Response: { user, token }
 */
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    const result = await login(username, password);
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.message || 'שגיאת התחברות',
    });
  }
});

/**
 * GET /api/auth/me
 * Headers: Authorization: Bearer <token>
 * Response: { user }
 */
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

/**
 * POST /api/auth/forgot-password
 * משתמש שכח סיסמה — מבקש איפוס מהמנהל.
 * Body: { username }
 *
 * מסיבות אבטחה: התשובה זהה גם אם המשתמש לא קיים.
 */
router.post('/forgot-password', (req, res) => {
  try {
    const { username } = req.body || {};
    const result = requestPasswordReset(username);
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

export default router;
