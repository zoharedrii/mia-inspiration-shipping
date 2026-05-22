# API Reference — מערכת ניהול משלוחים

תיעוד מלא של ה-endpoints של ה-Backend.

## 🌐 כתובת בסיס

- **פיתוח:** `http://localhost:3001/api`
- **ייצור:** `https://<domain>/api` _(יוגדר ב-deploy)_

## 🔐 אימות

רוב ה-endpoints דורשים JWT token ב-header:

```
Authorization: Bearer <token>
```

מקבלים את ה-token מ-`POST /api/auth/login` ושומרים אותו ב-`localStorage` תחת המפתח `mia_auth_token`.

תוקף הטוקן: **8 שעות**.

## 📋 פורמט תגובות

### הצלחה
```json
{ "data": "..." }
```
קוד: `200 OK` (קריאה) / `201 Created` (יצירה).

### שגיאה
```json
{ "error": "הודעת השגיאה בעברית" }
```

קודים נפוצים:
- `400` — בקשה לא תקינה (פרמטר חסר/שגוי)
- `401` — לא מאומת (אין/פג תוקף טוקן)
- `403` — אין הרשאה לפעולה
- `404` — לא נמצא
- `500` — שגיאת שרת

---

# 🔐 Auth — אימות

## POST `/api/auth/login`
התחברות לחשבון.

**Body:**
```json
{ "username": "admin", "password": "password123" }
```

**Response 200:**
```json
{
  "token": "eyJhbGc...",
  "user": {
    "id": 1,
    "username": "admin",
    "full_name": "מנהל מערכת",
    "role": "admin",
    "branch_id": null,
    "branch_name": null,
    "branch_code": null,
    "is_active": 1,
    "created_at": "2026-05-05 15:25:45"
  }
}
```

**Response 401:** `שם משתמש או סיסמה שגויים`

## GET `/api/auth/me`
מחזיר את פרטי המשתמש המחובר (לפי הטוקן).

**Headers:** `Authorization: Bearer <token>`

**Response 200:** `{ user: { ... } }` (כמו ב-login)

---

# 🏪 Branches — סניפים

## GET `/api/branches`
**הרשאה:** כל משתמש מחובר.

מחזיר את כל הסניפים הפעילים, ממוינים: מחסן ראשון, ואז סניפים לפי שם.

**Response 200:**
```json
{
  "branches": [
    {
      "id": 1, "code": "WH-CENTRAL", "branch_number": null,
      "name": "מחסן מרכזי - מייה", "city": "שוהם",
      "is_warehouse": 1
    },
    {
      "id": 2, "code": "BR-11", "branch_number": 11,
      "name": "מייה איילון", "city": "רמת גן",
      "contact_phone": "050-1902011", "is_warehouse": 0
    }
  ]
}
```

---

# 📦 Shipments — משלוחים

## POST `/api/shipments`
**הרשאה:** `admin`, `warehouse`, `branch`.

יצירת משלוח חדש. סטטוס התחלתי: `pending`.

הערה: עבור `branch` ו-`warehouse`, השרת מאלץ `source_branch_id` להיות הסניף של המשתמש.

**Body:**
```json
{
  "source_branch_id": 1,
  "target_branch_id": 2,
  "package_count": 5,
  "package_type": "02",
  "notes": "הערה אופציונלית"
}
```

ערכי `package_type` תקפים: `"01"` מעטפה, `"02"` חבילה, `"03"` חבילה כבדה, `"05"` משטח.

**Response 201:** `{ "shipment": { ... } }` — מבנה משלוח מלא (ראי GET שלמטה).

**שגיאות:** מספר אותו סניף שולח+יעד → `400`. כמות לא חיובית → `400`.

## GET `/api/shipments`
**הרשאה:** כל משתמש מחובר.

רשימת משלוחים. **משתמש `branch` רואה רק משלוחים של הסניף שלו** (השרת מסנן אוטומטית).

**Query params (אופציונליים):**
- `status` — סינון לפי סטטוס (`pending`/`sent`/`received`/`mismatch`/`cancelled`)
- `branch_id` — סינון לפי סניף (מתעלמים לעיני branch)
- `limit` — מקסימום תוצאות (ברירת מחדל 100)

**Response 200:**
```json
{
  "shipments": [
    {
      "id": 5, "reference_id": "SHP-20260520-A3F2",
      "status": "pending", "package_count": 5, "package_type": "02",
      "source_branch_id": 1, "target_branch_id": 2, "created_by": 1,
      "source_branch_name": "מחסן מרכזי - מייה",
      "target_branch_name": "מייה איילון",
      "created_by_full_name": "מנהל מערכת",
      "created_at": "2026-05-20 14:22:10",
      "received_count": null, "notes": null
    }
  ]
}
```

## GET `/api/shipments/:id`
**הרשאה:** כל מחובר. branch — רק אם הסניף שלו מעורב.

פרטי משלוח בודד — מבנה מורחב כולל פרטי קבלה וכל ה-JOINs.

## GET `/api/shipments/:id/history`
**הרשאה:** כמו לעיל.

היסטוריית שינויי סטטוס של המשלוח (מהישן לחדש).

**Response 200:**
```json
{
  "history": [
    { "id": 1, "old_status": null, "new_status": "pending",
      "changed_by_full_name": "מנהל מערכת",
      "notes": "יצירה ראשונית", "created_at": "..." },
    { "id": 2, "old_status": "pending", "new_status": "sent",
      "changed_by_full_name": "מנהל מחסן",
      "notes": "יצא מהמחסן", "created_at": "..." }
  ]
}
```

## POST `/api/shipments/:id/cancel`
**הרשאה דינמית:**
- `admin` — תמיד יכול לבטל (אם המשלוח עוד פתוח)
- `branch` — רק משלוחים שהוא יצר ובסטטוס `pending`

**Body (אופציונלי):** `{ "reason": "סיבת ביטול" }`

**שגיאות:**
- משלוח שכבר התקבל/בוטל → `400`
- branch מנסה לבטל משלוח של אחר → `403`
- warehouse/accounting → `403`

## POST `/api/shipments/:id/receive`
**הרשאה:** `admin`, או `branch` של סניף היעד.

אישור קבלה של משלוח. **משווה אוטומטית את הכמות שהתקבלה לכמות שנשלחה:**
- תואם → סטטוס `received`
- לא תואם → סטטוס `mismatch`

**Body:**
```json
{ "received_count": 5, "notes": "הכל תקין" }
```

## PATCH `/api/shipments/:id/status`
**הרשאה:** `admin`, `warehouse`.

שינוי סטטוס ידני (למשל סימון "נשלח" אחרי שיצא מהמחסן).

**Body:** `{ "status": "sent", "notes": "..." }`

ערכים: `pending`, `sent`, `received`, `mismatch`, `cancelled`.

---

# 📊 Reports — דוחות

**כל ה-endpoints הבאים דורשים הרשאה:** `admin` או `warehouse` בלבד.

## GET `/api/reports/monthly?year=2026&month=5`
דוח חודשי — כל המשלוחים שנוצרו בחודש. אם לא מועברים פרמטרים — מחזיר את החודש הנוכחי.

**Response 200:**
```json
{
  "period": "2026-05",
  "summary": {
    "total": 6, "pending": 2, "sent": 0, "received": 1,
    "mismatch": 1, "cancelled": 2,
    "total_packages": 20, "received_packages": 8
  },
  "shipments": [ ... ]
}
```

## GET `/api/reports/mismatches?from=YYYY-MM-DD&to=YYYY-MM-DD`
דוח אי-התאמות בטווח תאריכים.

**Response 200:**
```json
{
  "period": { "from": "2026-05-01", "to": "2026-06-01" },
  "summary": {
    "total": 3,
    "total_shortage": -5,
    "total_excess": 2
  },
  "shipments": [
    {
      "reference_id": "SHP-...", "package_count": 5, "received_count": 4,
      "diff": -1, "source_name": "...", "target_name": "...",
      "received_at": "..."
    }
  ]
}
```

## GET `/api/reports/active`
משלוחים שעוד לא הסתיימו (`pending` או `sent`) — כולל "ותק" (ימים מאז יצירה).

**Response 200:**
```json
{
  "summary": {
    "total": 2, "pending_count": 2, "sent_count": 0,
    "overdue_count": 1
  },
  "shipments": [
    { ..., "days_since_creation": 5 }
  ]
}
```

`overdue_count` = משלוחים פתוחים יותר מ-3 ימים.

## GET `/api/reports/branch/:id?from=YYYY-MM-DD&to=YYYY-MM-DD`
דוח פעילות סניף — משלוחים שיצאו וקיבל בטווח.

**Response 200:**
```json
{
  "branch": { ... },
  "period": { "from": "...", "to": "..." },
  "outgoing": { "total": 5, "total_packages": 23, "shipments": [...] },
  "incoming": { "total": 8, "total_packages": 40, "mismatches": 1, "shipments": [...] }
}
```

---

# 🩺 Health Check

## GET `/api/health`
בודק שהשרת חי. לא דורש אימות.

**Response 200:**
```json
{
  "status": "ok",
  "message": "שרת מייה אינספיריישן פועל",
  "timestamp": "2026-05-20T14:22:10.000Z",
  "uptime": 123.45
}
```

---

# 🔗 Orian Integration (פנימי)

## GET `/api/orian/test`
בדיקת חיבור ל-API של אוריין (Login). שימושי לבדיקת credentials.

**Response 200:**
```json
{
  "status": "ok",
  "message": "✅ התחברות לאוריין הצליחה",
  "environment": "https://disapiTest.orian.com"
}
```

**Response 500 (כשאין credentials):**
```json
{
  "status": "error",
  "message": "❌ התחברות לאוריין נכשלה",
  "reason": "חסרים פרטי גישה לאוריין: ORIAN_USERNAME ו/או ORIAN_PASSWORD לא הוגדרו ב-.env"
}
```
