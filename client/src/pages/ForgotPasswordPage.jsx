// מסך "שכחתי סיסמה"
//
// המשתמש מזין שם משתמש, השרת רושם בקשת איפוס.
// המנהל רואה את הבקשה ברשימת המשתמשים ומאפס את הסיסמה.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/client.js';

export default function ForgotPasswordPage() {
  const [username, setUsername] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await apiClient.post('/auth/forgot-password', { username: username.trim() });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || 'שגיאה בשליחת הבקשה');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-blue-50 to-emerald-50">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">מייה אינספיריישן</h1>
          </div>

          <div className="card text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-emerald-100 rounded-full flex items-center justify-center text-3xl">
              ✓
            </div>
            <h2 className="text-xl font-bold text-emerald-700">הבקשה התקבלה</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              אם שם המשתמש קיים במערכת, מנהל המערכת יקבל הודעה ויוכל לאפס את הסיסמה שלך בקרוב.
              <br />
              <br />
              לאחר שהמנהל יאפס את הסיסמה, ניתן יהיה להתחבר עם הסיסמה החדשה.
            </p>
            <Link to="/login" className="btn-primary inline-block">
              חזרה למסך התחברות
            </Link>

            <div className="pt-3 border-t border-gray-200 text-sm text-gray-600">
              רוצה לזרז? התקשרי למנהל המערכת:{' '}
              <a href="tel:08-9380937" className="font-medium text-blue-600 hover:text-blue-800" dir="ltr">
                08-9380937
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-blue-50 to-emerald-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">מייה אינספיריישן</h1>
          <p className="text-gray-600 mt-2">איפוס סיסמה</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-5">
          <div>
            <h2 className="text-xl font-bold text-gray-900">שכחתי סיסמה</h2>
            <p className="text-sm text-gray-600 mt-2 leading-relaxed">
              הזיני את שם המשתמש שלך. מנהל המערכת יקבל בקשה לאפס את הסיסמה,
              וכשתאופס תוכלי להתחבר עם הסיסמה החדשה.
            </p>
          </div>

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              שם משתמש
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={submitting}
              autoFocus
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         disabled:bg-gray-100"
              placeholder="לדוגמה: 11 או admin"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full disabled:opacity-50"
          >
            {submitting ? 'שולחת...' : 'שלח בקשה לאיפוס'}
          </button>

          <div className="text-center">
            <Link to="/login" className="text-sm text-blue-600 hover:underline">
              ← חזרה למסך התחברות
            </Link>
          </div>
        </form>

        <div className="mt-4 p-3 rounded-lg bg-gray-50 border border-gray-200 text-center text-sm text-gray-600">
          לא זוכרת את שם המשתמש? התקשרי למנהל המערכת:{' '}
          <a href="tel:08-9380937" className="font-medium text-blue-600 hover:text-blue-800" dir="ltr">
            08-9380937
          </a>
        </div>
      </div>
    </div>
  );
}
