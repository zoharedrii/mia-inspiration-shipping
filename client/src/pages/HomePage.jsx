// מסך הבית - דשבורד למשתמש מחובר
//
// מציג ברוכים הבאים, פרטי המשתמש, ופעולות ראשיות.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { listShipments } from '../api/shipments.js';

const ROLE_LABELS = {
  admin: 'מנהל מערכת',
  accounting: 'הנהלת חשבונות',
  warehouse: 'מחסן',
  branch: 'סניף',
};

// אילו פעולות זמינות לכל תפקיד
// דוחות זמינים רק למנהל מערכת ולמנהל מחסן (החלטה עסקית)
// ניהול משתמשים - admin בלבד
const ACTIONS_BY_ROLE = {
  admin:      ['create', 'list', 'reports', 'users'],
  warehouse:  ['create', 'list', 'reports'],
  branch:     ['create', 'list'],
  accounting: ['list'],
};

export default function HomePage() {
  const { user } = useAuth();
  const allowedActions = ACTIONS_BY_ROLE[user.role] || [];
  const [incomingShipments, setIncomingShipments] = useState([]);

  // משתמש סניף: לטעון משלוחים שמיועדים אליו בסטטוס sent (התראה)
  useEffect(() => {
    if (user.role === 'branch' && user.branch_id) {
      listShipments({ status: 'sent' })
        .then((all) => {
          const incoming = all.filter((s) => s.target_branch_id === user.branch_id);
          setIncomingShipments(incoming);
        })
        .catch(() => {});
    }
  }, [user.role, user.branch_id]);

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

      {/* התראה לסניף על משלוחים בדרך */}
      {incomingShipments.length > 0 && (
        <Link
          to="/shipments?status=sent"
          className="card border-blue-300 bg-blue-50 hover:bg-blue-100 transition-colors block"
        >
          <div className="flex items-start gap-3">
            <span className="text-3xl">🚚</span>
            <div className="flex-1">
              <div className="font-bold text-blue-900">
                {incomingShipments.length} {incomingShipments.length === 1 ? 'משלוח בדרך' : 'משלוחים בדרך'} לסניף שלך
              </div>
              <div className="text-sm text-blue-700 mt-1">
                הגעה צפויה תוך 24-48 שעות. לחצי לצפייה בפרטים ולאישור קבלה כשהמשלוחים יגיעו.
              </div>
            </div>
            <span className="text-blue-600 text-xl">←</span>
          </div>
        </Link>
      )}

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

        {allowedActions.includes('users') && (
          <Link
            to="/users"
            className="card hover:shadow-md hover:border-amber-200 transition-all
                       flex items-start gap-4 group"
          >
            <div className="h-12 w-12 rounded-xl bg-amber-100 text-amber-700
                            flex items-center justify-center text-2xl
                            group-hover:bg-amber-600 group-hover:text-white transition-colors">
              👥
            </div>
            <div>
              <h3 className="font-bold text-gray-900">ניהול משתמשים</h3>
              <p className="text-sm text-gray-500 mt-1">
                הוספה, עריכה והשבתה של עובדים
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
