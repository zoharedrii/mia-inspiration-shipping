// נקודת הכניסה של ה-Frontend
//
// כאן React "נדבק" ל-DOM ומתחיל לעבוד.
// AuthProvider עוטף הכל כדי שכל הרכיבים יוכלו לדעת אם המשתמש מחובר.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
