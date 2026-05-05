// ProtectedRoute - עוטף מסכים שדורשים login
//
// אם המשתמש לא מחובר - מפנה ל-/login.
// אם הוא מחובר - מציג את התוכן.
// בזמן הבדיקה הראשונית (loading) - מציג הודעה "טוען...".

import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">טוען...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
