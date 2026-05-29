// Header - פס עליון עם פרטי המשתמש המחובר, ניווט וכפתור התנתקות

import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// תוויות תפקידים בעברית
const ROLE_LABELS = {
  admin: 'מנהל מערכת',
  accounting: 'הנהלת חשבונות',
  warehouse: 'מחסן',
  branch: 'סניף',
};

// פריטי תפריט לפי תפקיד (לתפריט המבורגר במובייל)
const MENU_ITEMS_BY_ROLE = {
  admin:      ['home', 'create', 'list', 'reports', 'users'],
  warehouse:  ['home', 'create', 'list', 'reports'],
  branch:     ['home', 'create', 'list'],
  accounting: ['home', 'list'],
};

const MENU_ITEMS = {
  home:    { label: 'דף הבית',         icon: '🏠', to: '/' },
  create:  { label: 'יצירת משלוח',     icon: '➕', to: '/shipments/new' },
  list:    { label: 'רשימת משלוחים',   icon: '📋', to: '/shipments' },
  reports: { label: 'דוחות וניתוחים',  icon: '📊', to: '/reports' },
  users:   { label: 'ניהול משתמשים',   icon: '👥', to: '/users' },
};

export default function Header() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const isHomePage = location.pathname === '/';
  const isLoginPage = location.pathname === '/login' || location.pathname === '/forgot-password';

  // סגירת התפריט בלחיצה מחוץ
  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // סגירת התפריט במעבר לדף אחר
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  if (!user || isLoginPage) return null;

  const menuItems = (MENU_ITEMS_BY_ROLE[user.role] || []).map((key) => ({
    key,
    ...MENU_ITEMS[key],
  }));

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between gap-2 sm:gap-4">
        {/* ===== ימין: המבורגר + חזרה (במובייל) ===== */}
        <div className="flex items-center gap-1 sm:hidden">
          {/* כפתור המבורגר */}
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="p-2 rounded-md hover:bg-gray-100"
              aria-label="פתח תפריט"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            {/* תפריט נפתח */}
            {menuOpen && (
              <ul className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                {menuItems.map((item) => (
                  <li key={item.key}>
                    <Link
                      to={item.to}
                      className={`flex items-center gap-2 px-4 py-3 text-sm hover:bg-blue-50 ${
                        location.pathname === item.to ? 'bg-blue-100 font-medium' : ''
                      }`}
                    >
                      <span>{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  </li>
                ))}
                <li className="border-t border-gray-100">
                  <button
                    onClick={logout}
                    className="w-full text-right px-4 py-3 text-sm text-gray-600 hover:bg-gray-50"
                  >
                    🚪 התנתקות
                  </button>
                </li>
              </ul>
            )}
          </div>

          {/* כפתור חזרה - רק במובייל ולא בדף הבית */}
          {!isHomePage && (
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-md text-gray-600 hover:bg-gray-100"
              aria-label="חזרה אחורה"
              title="חזרה אחורה"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          )}
        </div>

        {/* ===== מרכז: לוגו/שם המערכת ===== */}
        <Link to="/" className="hover:opacity-75 transition-opacity flex-1 sm:flex-none">
          <h1 className="text-base sm:text-lg font-bold text-gray-900">מייה אינספיריישן</h1>
          <p className="text-xs text-gray-500 hidden sm:block">מערכת ניהול משלוחים</p>
        </Link>

        {/* ===== שמאל: פעולות (דסקטופ) ===== */}
        <div className="flex items-center gap-2 sm:gap-3 justify-end">
          {/* כפתור "דף הבית" - דסקטופ בלבד, ולא בדף הבית */}
          {!isHomePage && (
            <Link
              to="/"
              className="hidden sm:flex px-3 py-1.5 text-sm bg-blue-50 text-blue-700 border border-blue-200
                         rounded-md hover:bg-blue-100 transition-colors items-center gap-1"
            >
              🏠 <span>דף הבית</span>
            </Link>
          )}

          <div className="text-left hidden sm:block">
            <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
            <div className="text-xs text-gray-500">
              {ROLE_LABELS[user.role] || user.role}
              {user.branch_name ? ` · ${user.branch_name}` : ''}
            </div>
          </div>

          <button
            onClick={logout}
            className="hidden sm:block px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          >
            התנתקות
          </button>
        </div>
      </div>
    </header>
  );
}
