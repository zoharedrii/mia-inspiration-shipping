// AuthContext - ניהול מצב המשתמש המחובר ברמת כל האפליקציה
//
// React Context הוא דרך לחלוק נתונים בין רכיבים בלי "להעביר props".
// פה אנחנו שומרים מידע על המשתמש המחובר וחושפים פונקציות login/logout.
//
// הtoken נשמר ב-localStorage כדי שיישאר גם אחרי רענון דף.

import { createContext, useContext, useEffect, useState } from 'react';
import apiClient from '../api/client.js';

const AuthContext = createContext(null);

// מפתח השמירה ב-localStorage - מקדם "mia_" כדי לא להתנגש עם אפליקציות אחרות
export const TOKEN_KEY = 'mia_auth_token';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // loading=true בזמן הבדיקה הראשונית של ה-token
  const [loading, setLoading] = useState(true);

  // בעת אתחול - אם יש token שמור, מנסים לטעון את המשתמש
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }

    apiClient
      .get('/auth/me')
      .then((response) => setUser(response.data.user))
      .catch(() => {
        // הtoken לא תקין יותר - מנקים אותו
        localStorage.removeItem(TOKEN_KEY);
      })
      .finally(() => setLoading(false));
  }, []);

  /**
   * מתחברת עם שם משתמש וסיסמה. אם הצליח - שומרת את הtoken
   * ומעדכנת את המשתמש ב-state.
   */
  async function login(username, password) {
    const response = await apiClient.post('/auth/login', { username, password });
    const { token, user: userData } = response.data;
    localStorage.setItem(TOKEN_KEY, token);
    setUser(userData);
    return userData;
  }

  /**
   * מתנתקת - מנקה את ה-token ואת המשתמש מה-state.
   */
  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }

  const value = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: Boolean(user),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook לשימוש קל ב-AuthContext.
 * שימוש: const { user, login, logout } = useAuth();
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth חייב להיות בתוך <AuthProvider>');
  }
  return context;
}
