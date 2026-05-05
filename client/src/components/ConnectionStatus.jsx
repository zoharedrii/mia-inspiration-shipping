// רכיב שבודק אם ה-Backend חי ומציג את הסטטוס
//
// משמש כ-"sanity check" שכל המערכת מחוברת:
// Frontend (React) → Vite Proxy → Express Server → /api/health

import { useEffect, useState } from 'react';
import apiClient from '../api/client.js';

export default function ConnectionStatus() {
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    apiClient
      .get('/health')
      .then((response) => {
        setState({ status: 'ok', data: response.data });
      })
      .catch((error) => {
        setState({
          status: 'error',
          message: error.message,
        });
      });
  }, []);

  if (state.status === 'loading') {
    return (
      <div className="card flex items-center gap-3">
        <div className="h-3 w-3 rounded-full bg-gray-300 animate-pulse" />
        <span className="text-gray-500">בודק חיבור לשרת...</span>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="card border-status-error/30 bg-red-50">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-3 w-3 rounded-full bg-status-error" />
          <span className="font-medium text-status-error">השרת לא מגיב</span>
        </div>
        <p className="text-sm text-gray-600">
          וודאי שהשרת רץ על פורט 3001 (npm run dev בתיקיית server/)
        </p>
        <p className="text-xs text-gray-400 mt-2">{state.message}</p>
      </div>
    );
  }

  return (
    <div className="card border-status-received/30 bg-emerald-50">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-3 w-3 rounded-full bg-status-received" />
        <span className="font-medium text-emerald-700">השרת פועל ומחובר</span>
      </div>
      <pre className="text-xs text-gray-600 bg-white/60 p-3 rounded mt-2 overflow-x-auto">
{JSON.stringify(state.data, null, 2)}
      </pre>
    </div>
  );
}
