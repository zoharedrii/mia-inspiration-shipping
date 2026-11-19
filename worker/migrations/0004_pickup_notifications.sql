-- הזמנות איסוף: מה מערכת המשלוחים עשתה מול הלקוחה.
-- ההזמנה עצמה יושבת במערכת האיסוף (branch-pickup-worker). כאן נשמר רק
-- מתי הסניף אישר קבלה, האם ה-SMS ללקוחה נשלח, ומתי ההזמנה נסגרה.
CREATE TABLE IF NOT EXISTS pickup_notifications (
  order_number     TEXT PRIMARY KEY,
  pickup_branch_id INTEGER NOT NULL,              -- מספר הסניף במערכת האיסוף (1-18)
  branch_name      TEXT,
  customer_name    TEXT,
  customer_phone   TEXT,
  received_by      TEXT,                          -- שם העובדת שאישרה קבלה
  received_at      TEXT NOT NULL DEFAULT (datetime('now')),
  sms_status       TEXT NOT NULL DEFAULT 'pending', -- pending / sent / failed / no_phone
  sms_error        TEXT,
  sms_sent_at      TEXT,
  sms_attempts     INTEGER NOT NULL DEFAULT 0,
  closed_at        TEXT,                          -- מתי נשלח למערכת האיסוף "נסגרה"
  closed_via       TEXT                           -- customer (לינק) / branch (כפתור בסניף)
);
