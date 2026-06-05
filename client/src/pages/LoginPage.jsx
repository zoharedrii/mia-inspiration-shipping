// מסך התחברות

import { useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import PasswordInput from '../components/PasswordInput.jsx';

export default function LoginPage() {
  const { login, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // אם המשתמש כבר מחובר - מפנים מיד לבית
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await login(username, password);
      navigate('/', { replace: true });
    } catch (err) {
      // השרת מחזיר { error: "..." } - מציגים את ההודעה למשתמש
      const message = err.response?.data?.error || 'שגיאה לא צפויה. נסי שוב.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-blue-50 to-emerald-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">מייה אינספיריישן</h1>
          <p className="text-gray-600 mt-2">מערכת ניהול משלוחים</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-5">
          <h2 className="text-xl font-bold text-gray-900">התחברות</h2>

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              שם משתמש
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={submitting}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         disabled:bg-gray-100"
              placeholder="לדוגמה: admin"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              סיסמה
            </label>
            <PasswordInput
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={submitting}
            />
            <div className="mt-2 text-left">
              <Link to="/forgot-password" className="text-xs text-blue-600 hover:text-blue-800 hover:underline">
                שכחתי סיסמה?
              </Link>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || authLoading}
            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'מתחברת...' : 'התחברות'}
          </button>
        </form>

        <div className="mt-4 p-3 rounded-lg bg-gray-50 border border-gray-200 text-center text-sm text-gray-600">
          נתקלת בבעיה? צרי קשר עם מנהל המערכת בטלפון:{' '}
          <a href="tel:08-9380937" className="font-medium text-blue-600 hover:text-blue-800" dir="ltr">
            08-9380937
          </a>
        </div>
      </div>
    </div>
  );
}
