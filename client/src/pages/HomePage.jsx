// מסך הבית - דשבורד למשתמש מחובר
//
// מציג ברוכים הבאים, פרטי המשתמש, וסטטוס חיבור לשרת.
// בהמשך יתווספו: רשימת משלוחים, יצירת משלוח חדש וכו'.

import ConnectionStatus from '../components/ConnectionStatus.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const ROLE_LABELS = {
  admin: 'מנהל מערכת',
  accounting: 'הנהלת חשבונות',
  warehouse: 'מחסן',
  branch: 'סניף',
};

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          שלום, {user.full_name} 👋
        </h1>
        <p className="text-gray-600 mt-1">
          {ROLE_LABELS[user.role] || user.role}
          {user.branch_name ? ` · ${user.branch_name}` : ''}
        </p>
      </header>

      <ConnectionStatus />

      <div className="card">
        <h2 className="text-xl font-bold mb-3">המערכת בפיתוח 🚧</h2>
        <p className="text-gray-700 leading-relaxed">
          בשלב זה ה-Authentication עובד. בשלב הבא ניצור את מסכי המשלוחים:
        </p>
        <ul className="mt-3 space-y-2 text-gray-700">
          <li className="flex items-start gap-2">
            <span className="text-blue-600">•</span>
            יצירת בקשת משלוח חדשה (לסניף יעד / מחסן)
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600">•</span>
            רשימת המשלוחים שלי + סינון לפי סטטוס
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600">•</span>
            אישור קבלת משלוח עם בדיקת כמויות
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600">•</span>
            דוח משלוחים חודשי
          </li>
        </ul>
      </div>

      <div className="card">
        <h3 className="font-bold mb-3">צבעי סטטוס במערכת</h3>
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
