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
const ACTIONS_BY_ROLE = {
  admin: ['create', 'list'],
  warehouse: ['create', 'list'],
  branch: ['create', 'list'],
  accounting: ['list', 'reports'],
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
          <div className="card opacity-50 cursor-not-allowed flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-gray-100 text-gray-400
                            flex items-center justify-center text-2xl">
              📋
            </div>
            <div>
              <h3 className="font-bold text-gray-900">רשימת משלוחים</h3>
              <p className="text-sm text-gray-500 mt-1">
                בקרוב — מעקב אחרי כל המשלוחים
              </p>
            </div>
          </div>
        )}

        {allowedActions.includes('reports') && (
          <div className="card opacity-50 cursor-not-allowed flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-gray-100 text-gray-400
                            flex items-center justify-center text-2xl">
              📊
            </div>
            <div>
              <h3 className="font-bold text-gray-900">דוחות</h3>
              <p className="text-sm text-gray-500 mt-1">
                בקרוב — דוחות חודשיים ובקרה
              </p>
            </div>
          </div>
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
