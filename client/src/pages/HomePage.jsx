// מסך הבית - המסך הראשון שהמשתמש רואה
//
// כרגע: כותרת, סטטוס חיבור לשרת, וטקסט הסבר.
// בהמשך: יכלול התחברות / dashboard לפי סוג המשתמש.

import ConnectionStatus from '../components/ConnectionStatus.jsx';

export default function HomePage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <header className="text-center space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
          מייה אינספיריישן
        </h1>
        <p className="text-lg text-gray-600">
          מערכת ניהול ובקרת משלוחים פנים-ארגונית
        </p>
      </header>

      <ConnectionStatus />

      <div className="card">
        <h2 className="text-xl font-bold mb-3">ברוכות הבאות 🎉</h2>
        <p className="text-gray-700 leading-relaxed">
          זהו מסך הבית של המערכת. בשלב זה אנחנו רק מוודאות שכל הצינורות
          מחוברים: ה-Frontend מדבר עם ה-Backend, וה-Backend מוכן לדבר
          עם API של אוריין.
        </p>
        <p className="text-gray-700 leading-relaxed mt-3">
          בשלבים הבאים ניצור: התחברות משתמשים, יצירת הזמנות משלוח,
          מעקב סטטוסים, ואישור קבלה.
        </p>
      </div>

      <div className="card">
        <h3 className="font-bold mb-3">דוגמת צבעי סטטוס</h3>
        <div className="flex flex-wrap gap-3">
          <span className="px-4 py-2 rounded-full bg-status-sent text-white text-sm font-medium">
            נשלח
          </span>
          <span className="px-4 py-2 rounded-full bg-status-received text-white text-sm font-medium">
            התקבל
          </span>
          <span className="px-4 py-2 rounded-full bg-status-mismatch text-white text-sm font-medium">
            אי-התאמה
          </span>
          <span className="px-4 py-2 rounded-full bg-status-error text-white text-sm font-medium">
            שגיאה
          </span>
        </div>
      </div>
    </div>
  );
}
