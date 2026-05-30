// Routes לסניפים - כרגע רק קריאת רשימה (לטופס יצירת משלוח).

import { Hono } from 'hono';
import * as branches from '../services/branches.js';
import { requireAuth } from '../middleware/auth.js';

const router = new Hono();

/**
 * GET /api/branches - כל הסניפים הפעילים
 */
router.get('/', requireAuth, async (c) => {
  return c.json({ branches: await branches.getAllActive(c.env.DB) });
});

export default router;
