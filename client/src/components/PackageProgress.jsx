// בר התקדמות של חבילה — מציג איפה החבילה נמצאת במסע השילוח של אוריין.
//
// מושך את הסטטוס מ-GET /api/shipments/:id/package-status (נתון live בלבד).
// כל חבילה מקבלת שורת התקדמות עם 5 שלבים: נוצרה → נאספה → במיון → בהפצה → נמסרה.

import { useEffect, useState } from 'react';
import {
  getPackageStatus,
  PACKAGE_FLOW,
  PACKAGE_STATUS_LABELS,
} from '../api/shipments.js';

// סטטוסים חריגים שאינם חלק מהזרימה הרגילה
const EXCEPTION_STATUSES = {
  LOST: { label: 'החבילה אבדה', color: 'bg-red-600' },
  CANCELED: { label: 'החבילה בוטלה', color: 'bg-gray-500' },
};

// בר התקדמות לחבילה אחת
function SinglePackageBar({ pkg }) {
  const status = (pkg.status || '').toUpperCase();
  const exception = EXCEPTION_STATUSES[status];

  // המיקום של הסטטוס הנוכחי בזרימה (0..4). אם לא נמצא — נתייחס כ"נוצרה".
  let currentIndex = PACKAGE_FLOW.indexOf(status);
  if (currentIndex === -1) currentIndex = 0;

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-3">
      {/* כותרת: מספר חבילה + סטטוס נוכחי */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="font-mono text-sm text-gray-700">חבילה {pkg.package}</span>
        <span className="text-sm font-medium text-gray-900">
          {PACKAGE_STATUS_LABELS[status] || status || '—'}
        </span>
      </div>

      {exception ? (
        // סטטוס חריג — מציגים פס אחד בולט במקום מסע השלבים
        <div className={`${exception.color} text-white text-center text-sm py-2 rounded`}>
          {exception.label}
        </div>
      ) : (
        // מסע שלבים רגיל
        <div className="flex flex-row-reverse items-start justify-between">
          {PACKAGE_FLOW.map((step, i) => {
            const reached = i <= currentIndex;
            const isCurrent = i === currentIndex;
            return (
              <div key={step} className="flex-1 flex flex-col items-center relative">
                {/* קו מחבר לשלב הקודם (משמאל בתצוגת RTL) */}
                {i > 0 && (
                  <span
                    className={`absolute top-3 right-1/2 w-full h-0.5 ${
                      i <= currentIndex ? 'bg-emerald-500' : 'bg-gray-200'
                    }`}
                  />
                )}
                {/* העיגול */}
                <span
                  className={`relative z-10 h-6 w-6 rounded-full border-2 flex items-center justify-center text-xs
                    ${reached ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-gray-300 text-gray-400'}
                    ${isCurrent ? 'ring-2 ring-emerald-200' : ''}`}
                >
                  {reached ? '✓' : i + 1}
                </span>
                {/* תווית */}
                <span className={`mt-1.5 text-[11px] text-center ${reached ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
                  {PACKAGE_STATUS_LABELS[step]}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* קישור מעקב + תאריך עדכון */}
      <div className="flex items-center justify-between flex-wrap gap-2 pt-1 text-xs text-gray-500">
        {pkg.statusDate && <span>עודכן: {pkg.statusDate}</span>}
        {pkg.tracking && (
          <a
            href={pkg.tracking}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            מעקב באתר אוריין ←
          </a>
        )}
      </div>
    </div>
  );
}

export default function PackageProgress({ shipmentId }) {
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await getPackageStatus(shipmentId);
      setStatuses(data.statuses || []);
    } catch (err) {
      setError(err.response?.data?.error || 'לא ניתן לטעון את סטטוס החבילות');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipmentId]);

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-900">📦 מעקב חבילות (אוריין)</h2>
        <button
          onClick={load}
          disabled={loading}
          className="text-sm text-blue-600 hover:underline disabled:opacity-50"
        >
          {loading ? 'מרענן...' : '↻ רענון'}
        </button>
      </div>

      {loading && statuses.length === 0 && (
        <p className="text-sm text-gray-500">טוען סטטוס מאוריין...</p>
      )}

      {error && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      {!loading && !error && statuses.length === 0 && (
        <p className="text-sm text-gray-500">אין עדיין מידע על סטטוס החבילות.</p>
      )}

      {statuses.length > 0 && (
        <div className="space-y-3">
          {statuses.map((pkg) => (
            <SinglePackageBar key={pkg.package} pkg={pkg} />
          ))}
        </div>
      )}
    </div>
  );
}
