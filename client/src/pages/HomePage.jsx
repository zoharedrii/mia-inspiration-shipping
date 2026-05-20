// מסך הבית - דשבורד למשתמש מחובר
//
// מציג ברוכים הבאים, פרטי המשתמש, ופעולות ראשיות.

import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const ROLE_LABELS = {
  admin: 'מנהל מערכת',
  accounting: 'הנהלת חשבונות',
  warehouse: 'מחסן',
  branch: 'סניף',
};

// אילו פעולות זמינות לכל תפקיד
// דוחות זמינים רק למנהל מערכת ולמנהל מחסן (החלטה עסקית)
const ACTIONS_BY_ROLE = {
  admin:      ['create', 'list', 'reports'],
  warehouse:  ['create', 'list', 'reports'],
  branch:     ['create', 'list'],
  accounting: ['list'],
};

export default function HomePage() {
  const { user } = useAuth();
  const allowedActions = ACTIONS_BY_ROLE[user.role] || [];

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

      {/* פעולות ראשיות */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {allowedActions.includes('create') && (
          <Link
            to="/shipments/new"
            className="card hover:shadow-md hover:border-blue-200 transition-all
                       flex items-start gap-4 group"
          >
            <div className="h-12 w-12 rounded-xl bg-blue-100 text-blue-600
                            flex items-center justify-center text-2xl
                            group-hover:bg-blue-600 group-hover:text-white transition-colors">
              +
            </div>
            <div>
              <h3 className="font-bold text-gray-900">יצירת משלוח חדש</h3>
              <p className="text-sm text-gray-500 mt-1">
                שליחת מארזים לסניף אחר במערכת
              </p>
            </div>
          </Link>
        )}

        {allowedActions.includes('list') && (
          <Link
            to="/shipments"
            className="card hover:shadow-md hover:border-blue-200 transition-all
                       flex items-start gap-4 group"
          >
            <div className="h-12 w-12 rounded-xl bg-emerald-100 text-emerald-600
                            flex items-center justify-center text-2xl
                            group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              📋
            </div>
            <div>
              <h3 className="font-bold text-gray-900">רשימת משלוחים</h3>
              <p className="text-sm text-gray-500 mt-1">
                מעקב אחרי כל המשלוחים שלך
              </p>
            </div>
          </Link>
        )}

        {allowedActions.includes('reports') && (
          <Link
            to="/reports"
            className="card hover:shadow-md hover:border-purple-200 transition-all
                       flex items-start gap-4 group"
          >
            <div className="h-12 w-12 rounded-xl bg-purple-100 text-purple-600
                            flex items-center justify-center text-2xl
                            group-hover:bg-purple-600 group-hover:text-white transition-colors">
              📊
            </div>
            <div>
              <h3 className="font-bold text-gray-900">דוחות וניתוחים</h3>
              <p className="text-sm text-gray-500 mt-1">
                דוח חודשי, אי-התאמות, פעילות סניף
              </p>
            </div>
          </Link>
        )}
      </div>

      {/* מידע על הפרויקט */}
      <div className="card bg-blue-50/50 border-blue-100">
        <h2 className="text-lg font-bold mb-2">המערכת בפיתוח 🚧</h2>
        <p className="text-sm text-gray-700">
          השלב הנוכחי: יצירת משלוחים פנים-ארגוניים. בקרוב נוסיף רשימת משלוחים,
          אישורי קבלה, ואינטגרציה אוטומטית עם API של אוריין.
        </p>
      </div>
    </div>
  );
}
