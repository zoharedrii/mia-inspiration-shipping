# Database Schema — בסיס הנתונים

## 🛢️ סוג מסד הנתונים

**SQLite 3** — DB מקומי, קובץ אחד, ללא שרת נפרד.

- **מיקום:** `server/data/mia.db`
- **לא ב-Git:** הקובץ ב-`.gitignore` (יציאתו אצל כל אחד מהצוות)
- **בנייה ראשונית:** ה-schema נוצר אוטומטית בהפעלה הראשונה של השרת
- **נתוני התחלה:** נטענים אוטומטית מ-`server/src/db/seed.js`

## 📊 תרשים יחסים (ERD)

```
┌─────────────────┐
│    branches     │
├─────────────────┤
│ id              │◄────┐
│ code            │     │
│ branch_number   │     │
│ name            │     │
│ city            │     │
│ is_warehouse    │     │
│ ...             │     │
└─────────────────┘     │
                        │
        ┌───────────────┴────────────┐
        │                            │
┌───────┴────────┐          ┌────────┴───────┐
│     users      │          │   shipments    │
├────────────────┤          ├────────────────┤
│ id             │◄───┐     │ id             │
│ username       │    │     │ reference_id   │
│ password_hash  │    │     │ source_branch  │──┐
│ full_name      │    │     │ target_branch  │──┤
│ role           │    │     │ status         │  │
│ branch_id      │    └─────│ created_by     │  │
│ ...            │    ┌─────│ received_by    │  │
└────────────────┘    │     │ package_count  │  │
                      │     │ ...            │  │
                      │     └────────────────┘  │
                      │              ▲          │
                      │              │          │
                      │     ┌────────┴────────┐ │
                      │     │ status_history  │ │
                      │     ├─────────────────┤ │
                      │     │ id              │ │
                      │     │ shipment_id     │─┘
                      └─────│ changed_by      │
                            │ old_status      │
                            │ new_status      │
                            │ notes           │
                            │ created_at      │
                            └─────────────────┘
```

---

## 📁 הטבלאות

### 1. `branches` — סניפי הרשת

| עמודה | סוג | מגבלות | תיאור |
|--------|-----|---------|--------|
| `id` | INTEGER | PK, AUTOINCREMENT | מזהה ייחודי פנימי |
| `code` | TEXT | UNIQUE, NOT NULL | קוד הסניף (`WH-CENTRAL`, `BR-11`...) |
| `branch_number` | INTEGER | UNIQUE | מספר הסניף הרשמי במייה (11-30). NULL למחסן |
| `name` | TEXT | NOT NULL | שם הסניף ("מייה איילון") |
| `address` | TEXT | | רחוב + מספר |
| `city` | TEXT | NOT NULL | עיר |
| `zip` | TEXT | | מיקוד |
| `phone` | TEXT | | טלפון קווי |
| `contact_name` | TEXT | | שם איש קשר |
| `contact_phone` | TEXT | | טלפון נייד |
| `is_warehouse` | INTEGER | NOT NULL, DEFAULT 0 | 1 = מחסן מרכזי, 0 = סניף |
| `is_active` | INTEGER | NOT NULL, DEFAULT 1 | סניף פעיל |
| `created_at` | TEXT | NOT NULL, DEFAULT CURRENT_TIMESTAMP | תאריך יצירה |

**אינדקסים:** PK על `id`, UNIQUE על `code` ו-`branch_number`.

**נתונים:** 19 רשומות (1 מחסן + 18 סניפים).

---

### 2. `users` — משתמשי המערכת

| עמודה | סוג | מגבלות | תיאור |
|--------|-----|---------|--------|
| `id` | INTEGER | PK, AUTOINCREMENT | |
| `username` | TEXT | UNIQUE, NOT NULL | שם משתמש להתחברות |
| `password_hash` | TEXT | NOT NULL | סיסמה מוצפנת bcrypt |
| `full_name` | TEXT | NOT NULL | שם מלא להצגה |
| `role` | TEXT | NOT NULL, CHECK | `admin` / `accounting` / `warehouse` / `branch` |
| `branch_id` | INTEGER | FK → branches.id | סניף משויך (רלוונטי ל-warehouse/branch) |
| `is_active` | INTEGER | NOT NULL, DEFAULT 1 | משתמש פעיל |
| `created_at` | TEXT | NOT NULL, DEFAULT CURRENT_TIMESTAMP | |

**אינדקסים:** PK, UNIQUE על `username`, INDEX על `username` למהירות.

**משתמשי seed:**
- `admin` (admin, ללא סניף)
- `warehouse` (warehouse, משויך למחסן)
- `11`, `12`, ... `30` (branch, כל אחד לסניף שלו)

---

### 3. `shipments` — המשלוחים

| עמודה | סוג | מגבלות | תיאור |
|--------|-----|---------|--------|
| `id` | INTEGER | PK, AUTOINCREMENT | מזהה פנימי |
| `reference_id` | TEXT | UNIQUE, NOT NULL | מזהה חיצוני: `SHP-YYYYMMDD-XXXX` |
| `source_branch_id` | INTEGER | NOT NULL, FK → branches | הסניף השולח |
| `target_branch_id` | INTEGER | NOT NULL, FK → branches | סניף היעד |
| `package_count` | INTEGER | NOT NULL, CHECK > 0 | כמות מארזים שנשלחה |
| `package_type` | TEXT | NOT NULL, DEFAULT '02' | `'01'` מעטפה / `'02'` חבילה / `'03'` חבילה כבדה / `'05'` משטח |
| `status` | TEXT | NOT NULL, CHECK | `pending`/`sent`/`received`/`mismatch`/`cancelled` |
| `orian_order_id` | TEXT | | מזהה שאוריין החזירה (לעתיד) |
| `notes` | TEXT | | הערות חופשיות (עד 200 תווים) |
| `created_by` | INTEGER | NOT NULL, FK → users | מי יצר את המשלוח |
| `received_count` | INTEGER | | כמה מארזים התקבלו בפועל (NULL עד אישור) |
| `received_by` | INTEGER | FK → users | מי אישר את הקבלה |
| `received_at` | TEXT | | תאריך האישור |
| `created_at` | TEXT | NOT NULL, DEFAULT CURRENT_TIMESTAMP | |
| `updated_at` | TEXT | NOT NULL, DEFAULT CURRENT_TIMESTAMP | |

**אינדקסים:** על `status`, `source_branch_id`, `target_branch_id`.

**זרימת סטטוסים:**
```
pending ──┬──► sent ────► received
          │           └─► mismatch
          └──► cancelled
                ▲
                │
              sent ───► cancelled (רק admin)
```

---

### 4. `shipment_status_history` — היסטוריית שינויי סטטוס

| עמודה | סוג | מגבלות | תיאור |
|--------|-----|---------|--------|
| `id` | INTEGER | PK, AUTOINCREMENT | |
| `shipment_id` | INTEGER | NOT NULL, FK → shipments | |
| `old_status` | TEXT | | הסטטוס לפני (NULL עבור יצירה) |
| `new_status` | TEXT | NOT NULL | הסטטוס החדש |
| `changed_by` | INTEGER | FK → users | מי ביצע את השינוי |
| `notes` | TEXT | | הערות (סיבת ביטול, פרטי אי-התאמה...) |
| `created_at` | TEXT | NOT NULL, DEFAULT CURRENT_TIMESTAMP | |

**אינדקסים:** על `shipment_id`.

**הערה:** נכתב **אוטומטית** בכל פעם שמתבצעת פעולה — יצירה, סימון נשלח, אישור קבלה, ביטול. אין מחיקה.

---

## 🔧 הגדרות SQLite

ה-DB מופעל עם:
- `journal_mode = WAL` — ביצועים טובים יותר לקריאה+כתיבה במקביל
- `foreign_keys = ON` — אכיפת FK (כבוי כברירת מחדל ב-SQLite!)

## 🌱 Seed Data

קובץ: `server/src/db/seed.js`

מאכלס את ה-DB **רק אם הוא ריק** (לא דורס נתונים קיימים).

- ✅ 1 מחסן מרכזי
- ✅ 18 סניפים
- ✅ 2 משתמשי מנהל (admin, warehouse) + 18 משתמשי סניף (לפי מספר הסניף)
