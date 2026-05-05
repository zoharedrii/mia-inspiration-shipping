// Endpoint לבדיקה שהשרת חי
// משמש לוודא שהשרת פועל לפני שמנסים להתחבר אליו מ-Frontend

import { Router } from 'express';

const router = Router();

// GET /api/health
// מחזיר סטטוס בסיסי של השרת
router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'שרת מייה אינספיריישן פועל',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export default router;
