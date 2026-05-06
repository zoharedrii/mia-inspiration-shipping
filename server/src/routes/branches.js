// Routes לסניפים
//
// כרגע רק קריאת רשימה (לטופס יצירת משלוח).
// בעתיד נוסיף ניהול סניפים על ידי admin.

import { Router } from 'express';
import * as branches from '../services/branches.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/branches
 * מחזיר את כל הסניפים הפעילים
 */
router.get('/', requireAuth, (req, res) => {
  res.json({ branches: branches.getAllActive() });
});

export default router;
