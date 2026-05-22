# Permissions — מודל הרשאות במערכת

## 👥 4 סוגי משתמשים (Roles)

| Role | תיאור | משתמשי דוגמה |
|------|--------|---------------|
| `admin` | מנהל מערכת — שליטה מלאה | `admin` |
| `warehouse` | מנהל מחסן מרכזי | `warehouse` |
| `branch` | עובד סניף | `11`, `12`, ... `30` (לפי מספר סניף) |
| `accounting` | הנהלת חשבונות — צפייה בלבד | (אין משתמש seed כרגע) |

## 🎯 טבלת הרשאות מלאה

### פעולות על משלוחים

| פעולה | admin | warehouse | branch | accounting |
|--------|:-----:|:---------:|:------:|:----------:|
| צפייה ברשימת משלוחים | ✅ כל המערכת | ✅ כל המערכת | 🔵 רק של הסניף שלו | ✅ כל המערכת |
| צפייה בפרטי משלוח | ✅ כל אחד | ✅ כל אחד | 🔵 רק של הסניף שלו | ✅ כל אחד |
| יצירת משלוח חדש | ✅ | ✅ (מהמחסן) | ✅ (מהסניף שלו) | ❌ |
| סימון "נשלח" | ✅ | ✅ | ❌ | ❌ |
| אישור קבלה | ✅ | ❌ | 🔵 רק של משלוח שמיועד לסניף שלו | ❌ |
| ביטול משלוח | ✅ (תמיד) | ❌ | 🔵 רק משלוח שיצר ובסטטוס pending | ❌ |
| צפייה בהיסטוריית סטטוסים | ✅ | ✅ | 🔵 רק של הסניף שלו | ✅ |

### גישה לדוחות

| דוח | admin | warehouse | branch | accounting |
|-----|:-----:|:---------:|:------:|:----------:|
| דוח חודשי | ✅ | ✅ | ❌ | ❌ |
| דוח אי-התאמות | ✅ | ✅ | ❌ | ❌ |
| דוח משלוחים פעילים | ✅ | ✅ | ❌ | ❌ |
| דוח פעילות סניף | ✅ | ✅ | ❌ | ❌ |

> **הערה:** האפיון המקורי כלל את accounting בדוחות. הוסר לפי בקשת הצוות.

---

## 🔍 לוגיקות מיוחדות

### 1. סניף רואה רק משלוחים של עצמו

ב-`GET /api/shipments` — אם המשתמש הוא `branch`, השרת מאלץ סינון:
```sql
WHERE source_branch_id = :user_branch OR target_branch_id = :user_branch
```

הסניף לא יכול לראות (גם לא דרך ה-API ישירות) משלוחים שאינם שלו.

### 2. סניף יוצר משלוחים רק מהסניף שלו

ב-`POST /api/shipments` — גם אם המשתמש שולח `source_branch_id` אחר ב-body, השרת מתעלם ומשתמש ב-`req.user.branch_id`.

### 3. ביטול — הלוגיקה המורכבת ביותר

| מי | מתי | למה |
|-----|------|------|
| `admin` | בסטטוס `pending` או `sent` | יכול לתקן טעויות בכל שלב |
| `branch` | רק משלוח **שהוא יצר** ובסטטוס `pending` | יכול לחזור בו לפני שהמחסן מתחיל לעבד |
| `warehouse` | ❌ אסור לבטל | שינויי סטטוס דרך "סימון נשלח" בלבד |
| `accounting` | ❌ אסור לבטל | רק צפייה |

> אסור לבטל משלוח בסטטוס `received` / `mismatch` / `cancelled` (סופי).

### 4. אישור קבלה — רק סניף היעד

ב-`POST /api/shipments/:id/receive`:
- `admin` — תמיד יכול
- `branch` — רק אם `target_branch_id === user.branch_id`

המערכת **לא תאפשר לסניף לאשר קבלת משלוח שלא יועד אליו**.

---

## 🛡️ איך זה ממומש?

### Backend — שכבת middleware

```js
// בכל route:
router.get('/', requireAuth, handler);
router.post('/', requireAuth, requireRole('admin', 'warehouse'), handler);
```

הקוד ב-`server/src/middleware/auth.js`:
- `requireAuth` — מאמת JWT, מטעין את המשתמש מ-DB, מוסיף `req.user`
- `requireRole(...roles)` — מאפשר רק אם `req.user.role` ברשימה

### לוגיקה דינמית (תוך הkode)

לפעולות עם תנאים מורכבים (כמו ביטול), הבדיקה נמצאת **בתוך ה-service**:

```js
// server/src/services/shipments.js - cancelShipment
if (user.role === 'admin') { /* תמיד מותר */ }
else if (user.role === 'branch') {
  if (shipment.created_by !== user.id) throw 403;
  if (shipment.status !== 'pending') throw 400;
}
else throw 403;
```

### Frontend — UI חכם

ב-Frontend אנחנו **לא** חושפים פעולות שאסורות:
- כפתור "ביטול" מופיע רק אם `canCancelShipment(shipment, user) === true`
- כרטיס "דוחות" בדשבורד מופיע רק לפי `ACTIONS_BY_ROLE[user.role]`
- מסך "יצירת משלוח" מסתיר את שדה "סניף שולח" עבור branch

**אבל** — ההגנה האמיתית היא **בשרת**. ה-Frontend הוא "shortcut" ל-UX טוב, לא מנגנון אבטחה.

---

## 📋 דוגמאות שימוש

### תרחיש 1 — branch מנסה לבטל משלוח שלא שלו
```
POST /api/shipments/5/cancel
Authorization: Bearer <branch_11_token>
```
**שיב:** `403 — "ניתן לבטל רק משלוחים שיצרת בעצמך"`

### תרחיש 2 — accounting מנסה לראות דוחות
```
GET /api/reports/monthly
Authorization: Bearer <accounting_token>
```
**שיב:** `403 — "אין לך הרשאה לבצע פעולה זו"`

### תרחיש 3 — admin מבטל משלוח ב-status=sent
```
POST /api/shipments/3/cancel
Authorization: Bearer <admin_token>
Body: { "reason": "נשלח בטעות, לא רוצים את הסחורה" }
```
**שיב:** `200 — { shipment: {... status: "cancelled" } }`
