# Frontend — ממשק המערכת

ממשק המשתמש של מערכת המשלוחים. נבנה ב-React עם Vite, מעוצב ב-Tailwind CSS, ומותאם ל-RTL ומובייל.

## 🛠️ טכנולוגיות

- **React 18** — ספריית UI
- **Vite** — בונה פיתוח מהיר עם Hot Reload
- **Tailwind CSS** — עיצוב באמצעות מחלקות utility
- **React Router** — ניווט בין מסכים
- **axios** — קריאות HTTP לשרת

## 📦 התקנה

מתוך התיקייה `client/`:

```bash
npm install
```

## 🚀 הפעלה

### לפני שמתחילים

⚠️ **חשוב:** השרת (`server/`) חייב לרוץ על פורט 3001 כדי שה-Frontend יוכל לדבר איתו.

פתחי טרמינל **נוסף** בתיקיית `server/` והריצי:
```bash
npm run dev
```

### הפעלת ה-Frontend

מתוך תיקיית `client/`:

```bash
npm run dev
```

Vite ייפתח על **http://localhost:5173**

## 🔍 בדיקה שהכל עובד

1. ה-Frontend ייפתח בדפדפן אוטומטית
2. במסך הבית יש "סטטוס חיבור" — אמור להציג ירוק "השרת פועל ומחובר"
3. אם אדום — וודאי שהשרת רץ ב-`server/` על פורט 3001

## 📁 מבנה התיקיות

```
client/
├── src/
│   ├── main.jsx          # נקודת הכניסה - React נדבק ל-DOM
│   ├── App.jsx           # ניווט בין מסכים
│   ├── index.css         # Tailwind + סגנונות גלובליים
│   ├── api/
│   │   └── client.js     # axios - קריאות לשרת
│   ├── pages/            # מסכים מלאים
│   │   └── HomePage.jsx
│   └── components/       # רכיבים לשימוש חוזר
│       └── ConnectionStatus.jsx
├── index.html            # קובץ HTML שורש (RTL + עברית)
├── vite.config.js        # הגדרות Vite + פרוקסי לשרת
├── tailwind.config.js    # הגדרות Tailwind + צבעי סטטוס
└── postcss.config.js     # PostCSS - מעבד CSS
```

## 🎨 צבעי סטטוס מוגדרים

מותאמים לאפיון בעבודה התאורטית:

| מחלקה | צבע | משמעות |
|--------|-----|---------|
| `bg-status-sent` | כחול | משלוח נשלח |
| `bg-status-received` | ירוק | משלוח התקבל |
| `bg-status-mismatch` | כתום | אי-התאמה בכמות |
| `bg-status-error` | אדום | שגיאה |
