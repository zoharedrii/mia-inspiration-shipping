// Routes לניהול משתמשים (admin בלבד).

import { Hono } from 'hono';
import * as users from '../services/users.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = new Hono();

// כל ה-routes מוגבלים ל-admin
router.use('*', requireAuth, requireRole('admin'));

/**
 * GET /api/users - רשימת כל המשתמשים (כולל מושבתים)
 */
router.get('/', async (c) => {
  return c.json({ users: await users.listAll(c.env.DB) });
});

/**
 * POST /api/users - יצירת משתמש חדש
 * Body: { username, password, full_name, role, branch_id? }
 */
router.post('/', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const user = await users.createUser(c.env.DB, body);
    return c.json({ user }, 201);
  } catch (error) {
    return c.json({ error: error.message }, error.statusCode || 500);
  }
});

/**
 * PATCH /api/users/:id - עדכון פרטי משתמש
 * Body: { full_name, role, branch_id? }
 */
router.patch('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    const body = await c.req.json().catch(() => ({}));
    const user = await users.updateUser(c.env.DB, id, body);
    return c.json({ user });
  } catch (error) {
    return c.json({ error: error.message }, error.statusCode || 500);
  }
});

/**
 * PATCH /api/users/:id/active - הפעלה / השבתה
 * Body: { is_active: true | false }
 */
router.patch('/:id/active', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    const { is_active } = await c.req.json().catch(() => ({}));
    const user = await users.setActive(c.env.DB, id, Boolean(is_active), c.get('user').id);
    return c.json({ user });
  } catch (error) {
    return c.json({ error: error.message }, error.statusCode || 500);
  }
});

/**
 * POST /api/users/:id/reset-password - איפוס סיסמה
 * Body: { password }
 */
router.post('/:id/reset-password', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    const { password } = await c.req.json().catch(() => ({}));
    await users.resetPassword(c.env.DB, id, password);
    return c.json({ ok: true });
  } catch (error) {
    return c.json({ error: error.message }, error.statusCode || 500);
  }
});

export default router;
