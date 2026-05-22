# Architecture — ארכיטקטורת המערכת

תיאור כללי של איך המערכת בנויה ואיך הרכיבים מדברים זה עם זה.

## 🏗️ סקירה כללית

המערכת בנויה בארכיטקטורת **Client-Server** עם **3 שכבות**:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  👩 משתמשת (סניף / מחסן / מנהל)                                  │
│                              │                                  │
│                              │ דפדפן (HTTPS)                    │
│                              ▼                                  │
│  ┌───────────────────────────────────────────────────────┐     │
│  │  📱 Frontend (React + Vite)         פורט 5173 בפיתוח   │     │
│  │  - מסכי משתמש                                          │     │
│  │  - אימות, נתב בין דפים, ניהול state                    │     │
│  │  - שולח קריאות HTTP ל-Backend                          │     │
│  └───────────────────────────────────────────────────────┘     │
│                              │                                  │
│                              │ HTTP / JSON                      │
│                              ▼                                  │
│  ┌───────────────────────────────────────────────────────┐     │
│  │  ⚙️ Backend (Node.js + Express)    פורט 3001 בפיתוח   │     │
│  │  - REST API                                            │     │
│  │  - אימות (JWT), הרשאות (RBAC)                          │     │
│  │  - לוגיקה עסקית: יצירת משלוח, חישוב סטטוס...           │     │
│  └───────────────────────────────────────────────────────┘     │
│              │                                │                 │
│              │ SQL                            │ HTTP/XML        │
│              ▼                                ▼                 │
│  ┌────────────────────┐         ┌────────────────────────┐     │
│  │  💾 SQLite DB      │         │  🚚 Orian API          │     │
│  │  קובץ מקומי         │         │  (חיצוני, של חברת     │     │
│  │  - users           │         │   השליחויות)          │     │
│  │  - branches        │         │  - יצירת הזמנה         │     │
│  │  - shipments       │         │  - מעקב סטטוס          │     │
│  │  - history         │         │  - מדבקות PDF          │     │
│  └────────────────────┘         └────────────────────────┘     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🧩 השכבות

### 1️⃣ Frontend — `client/`

**טכנולוגיות:**
- React 18 + Vite 6 (build tool מהיר)
- Tailwind CSS — עיצוב responsive + RTL
- React Router 7 — ניתוב בין דפים
- axios — קריאות HTTP

**אחריות:**
- הצגת מסכים בעברית, RTL, מותאם מובייל
- ניהול state של משתמש מחובר (Context)
- בדיקת הרשאות בצד הלקוח (להסתיר/להציג כפתורים)
- שמירת JWT token ב-`localStorage`

**מבנה תיקיות:**
```
client/src/
├── pages/         מסכים מלאים (Login, HomePage, Reports...)
├── components/    רכיבים לשימוש חוזר (Header, Layout, StatusBadge)
├── context/       AuthContext - ניהול מצב משתמש
├── api/           קריאות לשרת (פונקציות אסינכרוניות)
└── main.jsx       נקודת כניסה
```

### 2️⃣ Backend — `server/`

**טכנולוגיות:**
- Node.js 20+ (JavaScript ES Modules)
- Express 5 — framework
- jsonwebtoken — JWT
- bcrypt — הצפנת סיסמאות
- better-sqlite3 — DB client
- axios + fast-xml-parser — תקשורת עם אוריין
- helmet, cors, morgan — אבטחה ולוגינג

**אחריות:**
- REST API — endpoints ב-`/api/*`
- אימות (Login, JWT verify)
- הרשאות (Role-Based Access Control)
- לוגיקה עסקית — לדוגמה, ביטול עם בדיקת תפקיד+סטטוס
- אינטגרציה עם אוריין

**מבנה תיקיות:**
```
server/src/
├── routes/         endpoints (auth, shipments, reports, branches, orian)
├── services/       לוגיקה עסקית (shipments, reports, auth, users, orian/*)
├── middleware/     auth, errorHandler
├── db/             schema, seed, connection
└── index.js        הפעלת השרת
```

### 3️⃣ Database — SQLite

**איפה:**
- קובץ מקומי `server/data/mia.db`
- WAL mode להופעות טובות

**טבלאות:** `branches`, `users`, `shipments`, `shipment_status_history`

ראי [DATABASE.md](DATABASE.md) לפרטים מלאים.

### 🔌 אינטגרציה עם אוריין (חיצוני)

**מטרה:** כשנוצר משלוח במערכת שלנו, ייפתח אוטומטית גם משלוח אצל חברת השליחויות.

**מצב נוכחי:** הקוד **מוכן** ומחכה ל-credentials. ה-flow:

```
1. סניף יוצר משלוח → השרת שומר ב-DB עם status=pending
2. השרת מתחבר לאוריין: POST /Login → מקבל AuthToken
3. השרת שולח: POST /CreateTransportationOrder (XML)
4. אוריין מחזיר אישור + מזהה
5. השרת שומר את ה-orian_order_id ב-DB
6. סטטוס מתעדכן ל-sent
```

**שימי לב:** ה-API של אוריין מבוסס **XML**, אז יש שכבת תרגום JSON ↔ XML ב-`server/src/services/orian/`.

---

## 🔐 זרימת אימות

```
1. משתמשת מקלידה username + password ב-LoginPage
                ↓
2. Frontend שולח: POST /api/auth/login
                ↓
3. Backend בודק:
   - האם המשתמש קיים?
   - bcrypt.compare(password, hashed)
                ↓
4. אם תקין: יוצר JWT עם sub=user.id, role, branch_id
   חתום עם JWT_SECRET, תוקף 8 שעות
                ↓
5. Frontend שומר ב-localStorage: mia_auth_token
                ↓
6. בכל בקשה נוספת, axios interceptor מוסיף:
   Authorization: Bearer <token>
                ↓
7. Backend middleware (requireAuth):
   - מאמת חתימה ותוקף
   - טוען את המשתמש מ-DB
   - מוסיף req.user
                ↓
8. אם requireRole צריך - בודק req.user.role
```

---

## 🌐 פיתוח vs ייצור

| היבט | פיתוח (Development) | ייצור (Production) |
|-------|-------------------|---------------------|
| Frontend port | 5173 (Vite) | מאוחד עם Backend או CDN |
| Backend port | 3001 | משתנה לפי deploy |
| CORS | פרוקסי דרך Vite | אותו domain |
| DB | SQLite מקומי | SQLite או PostgreSQL בענן |
| Orian | sandbox (`disapiTest.orian.com`) | production (`disapi.orian.com`) |
| .env | קובץ מקומי | משתני סביבה בענן |
| HMR | פעיל (vite dev) | לא פעיל (vite build) |

---

## 📁 מבנה הריפו הכולל

```
mia-inspiration-shipping/
├── README.md            סקירה ראשונית
├── start.bat            סקריפט הפעלה מהיר ב-Windows
├── .gitignore           הגנה על סודות וקבצים זמניים
├── CLAUDE.md            הוראות לקלוד
│
├── server/              Backend
│   ├── src/             קוד המקור
│   ├── data/            DB ⚠️ לא ב-Git
│   ├── .env             סודות ⚠️ לא ב-Git
│   ├── .env.example     תבנית
│   ├── package.json
│   └── README.md        הוראות הרצה
│
├── client/              Frontend
│   ├── src/             קוד המקור
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── package.json
│   └── README.md        הוראות הרצה
│
└── docs/                תיעוד טכני
    ├── API.md           תיעוד endpoints
    ├── DATABASE.md      schema + ERD
    ├── ARCHITECTURE.md  המסמך הזה
    ├── PERMISSIONS.md   טבלת הרשאות
    └── FLOWS.md         תרחישי שימוש מלאים
```
