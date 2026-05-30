-- סכמת מסד הנתונים - מערכת משלוחים מייה (D1)
-- מתאים לגרסה הסופית של server/src/db/schema.js (כולל not_received ו-password_reset_requested_at)

-- ====================================================================
-- branches - סניפי הרשת + מחסן מרכזי (נוצר ראשון כי users מצביע אליו)
-- ====================================================================
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

-- ====================================================================
-- users - משתמשי המערכת (4 תפקידים)
-- ====================================================================
CREATE TABLE IF NOT EXISTS users (
  id                            INTEGER PRIMARY KEY AUTOINCREMENT,
  username                      TEXT    UNIQUE NOT NULL,
  password_hash                 TEXT    NOT NULL,
  full_name                     TEXT    NOT NULL,
  role                          TEXT    NOT NULL CHECK(role IN ('admin', 'accounting', 'warehouse', 'branch')),
  branch_id                     INTEGER,
  is_active                     INTEGER NOT NULL DEFAULT 1,
  password_reset_requested_at   TEXT,
  created_at                    TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id)
);

-- ====================================================================
-- shipments - המשלוחים
-- ====================================================================
CREATE TABLE IF NOT EXISTS shipments (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  reference_id        TEXT    UNIQUE NOT NULL,
  source_branch_id    INTEGER NOT NULL,
  target_branch_id    INTEGER NOT NULL,
  package_count       INTEGER NOT NULL CHECK(package_count > 0),
  package_type        TEXT    NOT NULL DEFAULT '02',
  status              TEXT    NOT NULL DEFAULT 'pending'
                        CHECK(status IN ('pending','sent','received','mismatch','cancelled','not_received')),
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

-- ====================================================================
-- shipment_status_history - לוג שינויי סטטוס (לדוחות)
-- ====================================================================
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

-- אינדקסים
CREATE INDEX IF NOT EXISTS idx_users_username   ON users(username);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_source ON shipments(source_branch_id);
CREATE INDEX IF NOT EXISTS idx_shipments_target ON shipments(target_branch_id);
CREATE INDEX IF NOT EXISTS idx_history_shipment ON shipment_status_history(shipment_id);
