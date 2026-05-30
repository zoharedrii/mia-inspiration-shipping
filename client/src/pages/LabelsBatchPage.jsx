// מסך מדבקות מרובות - מציג ומדפיס כמה מדבקות יחד
//
// URL: /shipments/labels?ids=1,2,3
// מטעין במקביל את כל המשלוחים, מציג מדבקה לכל אחד.
// בהדפסה - כל מדבקה בעמוד נפרד (page-break).

import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getShipment, markShipmentAsSent } from '../api/shipments.js';
import ShippingLabel from '../components/ShippingLabel.jsx';

export default function LabelsBatchPage() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const idsParam = searchParams.get('ids') || '';
  const ids = idsParam.split(',').map((s) => parseInt(s.trim(), 10)).filter(Boolean);

  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState([]);
  const [autoSentCount, setAutoSentCount] = useState(0);

  useEffect(() => {
    if (ids.length === 0) {
      setLoading(false);
      return;
    }

    async function load() {
      // טעינה במקביל של כל המשלוחים
      const results = await Promise.allSettled(ids.map((id) => getShipment(id)));
      const loaded = [];
      const failed = [];
      results.forEach((r, i) => {
        if (r.status === 'fulfilled' && r.value) {
          loaded.push(r.value);
        } else {
          failed.push(ids[i]);
        }
      });

      // סימון אוטומטי כ"נשלח" למשלוחים שעדיין ממתינים - כמו בהדפסה בודדת.
      // רק admin/warehouse יכולים לסמן. כל משלוח מסומן פעם אחת בלבד.
      const canMark = user.role === 'admin' || user.role === 'warehouse';
      let autoSent = 0;
      let finalShipments = loaded;

      if (canMark) {
        finalShipments = await Promise.all(
          loaded.map(async (s) => {
            if (s.status !== 'pending') return s;
            try {
              const result = await markShipmentAsSent(s.id, 'print');
              if (!result.alreadySent) autoSent++;
              return result.shipment;
            } catch {
              return s; // אם הסימון נכשל - ממשיכים עם המדבקה כרגיל
            }
          })
        );
      }

      setShipments(finalShipments);
      setErrors(failed);
      setAutoSentCount(autoSent);
      setLoading(false);
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsParam]);

  // חישוב סך כל המדבקות (סכום מארזים מכל המשלוחים)
  const totalLabels = shipments.reduce((sum, s) => sum + (s.package_count || 1), 0);

  if (loading) {
    return <div className="max-w-2xl mx-auto px-4 py-8 text-center text-gray-500">טוען מדבקות...</div>;
  }

  if (ids.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <div className="card border-amber-200 bg-amber-50 text-amber-800">
          לא צוינו משלוחים. חזרי לרשימה ובחרי משלוחים להדפסה.
        </div>
        <Link to="/shipments" className="btn-secondary inline-block">חזרה לרשימה</Link>
      </div>
    );
  }

  return (
    <div className="bg-gray-100 min-h-screen py-8 print:bg-white print:py-0">
      {/* פס פעולה - מוסתר בהדפסה */}
      <div className="max-w-2xl mx-auto px-4 mb-4 flex gap-2 items-center print:hidden">
        <Link to="/shipments" className="btn-secondary">
          ← חזרה לרשימה
        </Link>
        <div className="text-sm text-gray-600 mx-3">
          {shipments.length} משלוחים · {totalLabels} מדבקות
          {errors.length > 0 && (
            <span className="text-red-600 mr-2">(נכשלו {errors.length})</span>
          )}
        </div>
        <button
          onClick={() => window.print()}
          disabled={shipments.length === 0}
          className="btn-primary mr-auto disabled:opacity-50"
        >
          🖨️ הדפסת כל המדבקות
        </button>
      </div>

      {/* הודעה כשמשלוחים סומנו אוטומטית כנשלחו */}
      {autoSentCount > 0 && (
        <div className="max-w-2xl mx-auto px-4 mb-4 print:hidden">
          <div className="card bg-emerald-50 border-emerald-300 text-emerald-800 text-sm">
            ✓ {autoSentCount} משלוחים סומנו אוטומטית כ"נשלח" וההיסטוריה תועדה. הסניפים המקבלים יראו אותם עכשיו ברשימה.
          </div>
        </div>
      )}

      {errors.length > 0 && (
        <div className="max-w-2xl mx-auto px-4 mb-4 print:hidden">
          <div className="card border-red-200 bg-red-50 text-red-700 text-sm">
            לא נטענו {errors.length} משלוחים (ID: {errors.join(', ')}). אולי אין הרשאה או שהם נמחקו.
          </div>
        </div>
      )}

      {/* כל המדבקות זו אחר זו - לולאה כפולה: עבור כל משלוח, מדבקה לכל מארז */}
      <div className="px-4 print:p-0 space-y-8 print:space-y-0">
        {shipments.flatMap((s, shipmentIdx) => {
          const isLastShipment = shipmentIdx === shipments.length - 1;
          return Array.from({ length: s.package_count }, (_, packageIdx) => {
            const isLastPackage = packageIdx === s.package_count - 1;
            const isVeryLast = isLastShipment && isLastPackage;
            return (
              <div
                key={`${s.id}-${packageIdx}`}
                className={!isVeryLast ? 'print:break-after-page' : ''}
              >
                <ShippingLabel
                  shipment={s}
                  packageIndex={packageIdx + 1}
                  totalPackages={s.package_count}
                />
              </div>
            );
          });
        })}

        <div className="text-center text-xs text-gray-500 mt-4 print:hidden">
          {totalLabels} מדבקות מוכנות להדפסה
          <br />
          במצב live: כל מדבקה תימשך מאוריין באמצעות מזהה ההזמנה.
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A6 landscape; margin: 5mm; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}
