// Endpoint לבדיקה שה-Worker חי.

import { Hono } from 'hono';

const router = new Hono();

// GET /api/health
router.get('/', (c) => {
  return c.json({
    status: 'ok',
    message: 'שרת מייה אינספיריישן פועל (Cloudflare Worker)',
    timestamp: new Date().toISOString(),
  });
});

export default router;
