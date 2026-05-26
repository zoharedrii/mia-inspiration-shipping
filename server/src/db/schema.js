// סכמת בסיס הנתונים - הגדרת טבלאות
//
// SQLite יוצר את הטבלאות אם הן לא קיימות (CREATE TABLE IF NOT EXISTS).
// כל קובץ מתאר את המבנה של טבלה אחת בצורה קריאה.

// ====================================================================
// users - משתמשי המערכת
// ====================================================================
// 4 סוגי משתמשים לפי האפיון:
// - admin: מנהל מערכת (גישה מלאה)
// - accounting: הנהלת חשבונות (צפייה + דוחות)
// - warehouse: מחסן (יצירת משלוחים מהמחסן)
// - branch: עובד סניף (יצירה + אישור קבלה בסניף שלו)
const USERS_TABLE = `
  CREATE TABLE IF NOT EXISTS users (
    id                              INTEGER PRIMARY KEY AUTOINCREMENT,
    username                        TEXT    UNIQUE NOT NULL,
    password_hash                   TEXT    NOT NULL,
    full_name                       TEXT    NOT NULL,
    role                            TEXT    NOT NULL CHECK(role IN ('admin', 'accounting', 'warehouse', 'branch')),
    branch_id                       INTEGER,
    is_active                       INTEGER NOT NULL DEFAULT 1,
    password_reset_requested_at     TEXT,
    created_at                      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (branch_id) REFERENCES branches(id)
  );
`;

// migration: הוספת עמודות חדשות לטבלאות קיימות (לא הורסת data)
const MIGRATIONS = [
  // password_reset_requested_at - שדה לבקשת איפוס סיסמה (נוסף בגרסה מאוחרת)
  () => {
    const cols = db => db.prepare("PRAGMA table_info(users)").all();
    return {
      sql: `ALTER TABLE users ADD COLUMN password_reset_requested_at TEXT`,
      shouldRun: (db) => !cols(db).some((c) => c.name === 'password_reset_requested_at'),
    };
  },
];

// ====================================================================
// branches - סניפי הרשת + מחסן מרכזי
// ====================================================================
// branch_number הוא המספר הרשמי של הסניף ברשת (11-30 לפי מייה).
// הוא ייחודי, אבל יכול להיות NULL עבור המחסן המרכזי שאין לו מספר רשמי.
const BRANCHES_TABLE = `
  CREATE TABLE IF NOT EXISTS branches (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    code            TEXT    UNIQUE NOT NULL,
    branch_number   INTEGER UNIQUE,
    name            TEXT    NOT NULL,
    address         TEXT,
    city            TEXT    NOT NULL,
    zip             TEXT,
    phone           TEXT,
    contact_name    TEXT,
    contact_phone   TEXT,
    is_warehouse    INTEGER NOT NULL DEFAULT 0,
    is_active       INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`;

// ====================================================================
// shipments - המשלוחים עצמם
// ====================================================================
// סטטוסים אפשריים:
// - pending: נוצרה הזמנה במערכת, טרם נשלחה לאוריין
// - sent: נשלחה לאוריין ויצאה לדרך
// - received: התקבלה ביעד והכמות אושרה
// - mismatch: התקבלה אבל יש אי-התאמה בכמות
// - cancelled: בוטלה
const SHIPMENTS_TABLE = `
  CREATE TABLE IF NOT EXISTS shipments (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    reference_id        TEXT    UNIQUE NOT NULL,
    source_branch_id    INTEGER NOT NULL,
    target_branch_id    INTEGER NOT NULL,
    package_count       INTEGER NOT NULL CHECK(package_count > 0),
    package_type        TEXT    NOT NULL DEFAULT '02',
    status              TEXT    NOT NULL DEFAULT 'pending'
                          CHECK(status IN ('pending','sent','received','mismatch','cancelled')),
    orian_order_id      TEXT,
    notes               TEXT,
    created_by          INTEGER NOT NULL,
    received_count      INTEGER,
    received_by         INTEGER,
    received_at         TEXT,
    created_at          TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_branch_id) REFERENCES branches(id),
    FOREIGN KEY (target_branch_id) REFERENCES branches(id),
    FOREIGN KEY (created_by)       REFERENCES users(id),
    FOREIGN KEY (received_by)      REFERENCES users(id)
  );
`;

// ====================================================================
// shipment_status_history - לוג שינויי סטטוס (לדוחות)
// ====================================================================
const STATUS_HISTORY_TABLE = `
  CREATE TABLE IF NOT EXISTS shipment_status_history (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    shipment_id  INTEGER NOT NULL,
    old_status   TEXT,
    new_status   TEXT    NOT NULL,
    changed_by   INTEGER,
    notes        TEXT,
    created_at   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shipment_id) REFERENCES shipments(id),
    FOREIGN KEY (changed_by)  REFERENCES users(id)
  );
`;

// אינדקסים - מאיצים חיפושים נפוצים
const INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_users_username   ON users(username);`,
  `CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);`,
  `CREATE INDEX IF NOT EXISTS idx_shipments_source ON shipments(source_branch_id);`,
  `CREATE INDEX IF NOT EXISTS idx_shipments_target ON shipments(target_branch_id);`,
  `CREATE INDEX IF NOT EXISTS idx_history_shipment ON shipment_status_history(shipment_id);`,
];

/**
 * יוצר את כל הטבלאות והאינדקסים אם אינם קיימים.
 * בטוח להריץ את זה בכל הפעלה - אם הטבלאות קיימות, לא קורה כלום.
 */
export function initSchema(db) {
  // הפעלת foreign keys (כבוי כברירת מחדל ב-SQLite)
  db.pragma('foreign_keys = ON');

  // יצירת טבלאות בסדר נכון - branches קודם כי users מצביע אליו
  db.exec(BRANCHES_TABLE);
  db.exec(USERS_TABLE);
  db.exec(SHIPMENTS_TABLE);
  db.exec(STATUS_HISTORY_TABLE);

  // אינדקסים
  for (const indexSql of INDEXES) {
    db.exec(indexSql);
  }

  // הרצת migrations - הוספת עמודות חדשות לטבלאות קיימות
  for (const migrationFn of MIGRATIONS) {
    const migration = migrationFn();
    if (migration.shouldRun(db)) {
      try {
        db.exec(migration.sql);
        console.log(`📦 [DB] migration הופעלה: ${migration.sql}`);
      } catch (err) {
        console.warn(`📦 [DB] migration נכשלה (אולי כבר רצה): ${err.message}`);
      }
    }
  }

  console.log('📦 [DB] סכמה אותחלה (4 טבלאות + אינדקסים)');
}
