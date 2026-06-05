# מערכת ניהול ובקרת משלוחים — מייה אינספיריישן

> פרויקט גמר במערכות מידע — מערכת לניהול משלוחים פנים-ארגוניים בין 18 סניפי הרשת למחסן המרכזי, עם אינטגרציה ישירה ל-API של חברת השליחויות אוריין.

---

## 🎯 מה המערכת עושה

המערכת מחליפה את התיאום הידני (טלפון/וואטסאפ) בין הסניפים, המחסן המרכזי וחברת השליחויות בממשק דיגיטלי אחיד שמעביר את כל המידע במקום אחד.

### 3 מודולים עיקריים

1. **הזמנת משלוח** — סניף יוצר בקשה → המערכת פותחת אוטומטית הזמנה אצל אוריין → התראה לסניף המקבל
2. **מעקב סטטוס** — `נשלח` / `התקבל` עם עדכונים מאוריין
3. **אישור קבלה ובקרה** — אימות כמות מארזים שהתקבלו מול הצפוי + דוח חודשי להנהלת חשבונות

---

## 👥 הצוות

- זוהר עדרי
- קורל בן נחום
- נופר רושו

**מנחה:** חן אהרוני

---

## 🛠️ טכנולוגיות

| שכבה | טכנולוגיה |
|------|-----------|
| Frontend | React + Vite |
| עיצוב | Tailwind CSS (RTL) |
| Backend | Cloudflare Workers + Hono |
| Database | Cloudflare D1 (SQLite) |
| API חיצוני | אוריין (Orian) — REST/XML |
| Deploy | Cloudflare Workers + Pages |

---

## 📁 מבנה הפרויקט

```
mia-inspiration-shipping/
├── client/         # אפליקציית הצד-לקוח (React + Vite)
├── worker/         # שרת ה-API (Cloudflare Worker + Hono + D1)
├── server/         # אב-טיפוס ראשוני (Node.js + Express) — הוחלף ב-worker/
└── docs/           # תיעוד טכני, תרשימים, הערות
```

---

## 🚀 איך להריץ

### דרישות מוקדמות
- Node.js גרסה 20 ומעלה
- חשבון Cloudflare (נדרש להרצה מול הענן; להרצה מקומית בלבד אפשר בלי)

### 1. הרצת ה-Backend (Worker)
```bash
cd worker
npm install
npm run db:migrate:local   # יצירת מסד הנתונים המקומי
npm run db:seed:local      # טעינת נתוני התחלה (סניפים, משתמשים)
npm run dev                # מריץ את ה-API באופן מקומי
```

> 🔑 להתחברות מול אוריין צריך ליצור קובץ `worker/.dev.vars` עם הסודות (`ORIAN_USERNAME`, `ORIAN_PASSWORD`, `JWT_SECRET`). הקובץ לא נכנס ל-Git מטעמי אבטחה.

### 2. הרצת ה-Frontend
```bash
cd client
npm install
npm run dev                # פותח את האפליקציה בכתובת http://localhost:5173
```

### 🌐 המערכת החיה (מותקנת ב-Cloudflare)
- **אפליקציה:** https://mia-shipping-frontend.pages.dev
- **API:** https://mia-shipping-api.edrizohar2.workers.dev/api

> פרטי התחברות לבדיקה — יימסרו בנפרד (לא מתפרסמים ברשת מטעמי אבטחה).

---

## 📚 תיעוד טכני מלא

| מסמך | תוכן |
|------|------|
| [API.md](docs/API.md) | תיעוד כל ה-endpoints (בקשות + תגובות + הרשאות) |
| [DATABASE.md](docs/DATABASE.md) | Schema של ה-DB + תרשים יחסים (ERD) |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | ארכיטקטורת המערכת + זרימת הנתונים |
| [PERMISSIONS.md](docs/PERMISSIONS.md) | מודל ההרשאות — מי יכול לעשות מה |
| [FLOWS.md](docs/FLOWS.md) | תרחישי שימוש מלאים (Happy Path + Edge Cases) |

---

_פרויקט אקדמי — המכללה למנהל, 2026_
