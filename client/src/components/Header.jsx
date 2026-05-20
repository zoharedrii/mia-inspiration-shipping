// Header - פס עליון עם פרטי המשתמש המחובר וכפתור התנתקות

import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// תווי תפקידים בעברית
const ROLE_LABELS = {
  admin: 'מנהל מערכת',
  accounting: 'הנהלת חשבונות',
  warehouse: 'מחסן',
  branch: 'סניף',
};

export default function Header() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isHomePage = location.pathname === '/';

  if (!user) return null;

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {/* לוגו + שם המערכת = קישור לבית */}
        <Link to="/" className="hover:opacity-75 transition-opacity">
          <h1 className="text-lg font-bold text-gray-900">מייה אינספיריישן</h1>
          <p className="text-xs text-gray-500">מערכת ניהול משלוחים</p>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
          {/* כפתור חזרה לדף הבית - מוצג רק אם לא בדף הבית */}
          {!isHomePage && (
            <Link
              to="/"
              className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 border border-blue-200
                         rounded-md hover:bg-blue-100 transition-colors flex items-center gap-1"
            >
              🏠 <span className="hidden sm:inline">דף הבית</span>
            </Link>
          )}

          <div className="text-left">
            <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
            <div className="text-xs text-gray-500">
              {ROLE_LABELS[user.role] || user.role}
              {user.branch_name ? ` · ${user.branch_name}` : ''}
            </div>
          </div>

          <button
            onClick={logout}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          >
            התנתקות
          </button>
        </div>
      </div>
    </header>
  );
}
