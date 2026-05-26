// Routes לניהול משתמשים (admin בלבד)

import { Router } from 'express';
import * as users from '../services/users.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// כל ה-routes מוגבלים ל-admin
router.use(requireAuth);
router.use(requireRole('admin'));

/**
 * GET /api/users
 * רשימת כל המשתמשים (כולל מושבתים)
 */
router.get('/', (req, res) => {
  res.json({ users: users.listAll() });
});

/**
 * POST /api/users
 * יצירת משתמש חדש
 * Body: { username, password, full_name, role, branch_id? }
 */
router.post('/', async (req, res) => {
  try {
    const user = await users.createUser(req.body || {});
    res.status(201).json({ user });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

/**
 * PATCH /api/users/:id
 * עדכון פרטי משתמש
 * Body: { full_name, role, branch_id? }
 */
router.patch('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const user = users.updateUser(id, req.body || {});
    res.json({ user });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

/**
 * PATCH /api/users/:id/active
 * הפעלה / השבתה של משתמש
 * Body: { is_active: true | false }
 */
router.patch('/:id/active', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { is_active } = req.body || {};
    const user = users.setActive(id, Boolean(is_active), req.user.id);
    res.json({ user });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

/**
 * POST /api/users/:id/reset-password
 * איפוס סיסמה
 * Body: { password }
 */
router.post('/:id/reset-password', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { password } = req.body || {};
    await users.resetPassword(id, password);
    res.json({ ok: true });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

export default router;
