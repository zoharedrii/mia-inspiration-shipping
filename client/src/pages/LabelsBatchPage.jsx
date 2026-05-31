// מסך מדבקות מרובות - מושך PDF מאוריין ומדפיס כמה מדבקות יחד
//
// URL: /shipments/labels?ids=1,2,3

import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getShipment, getShipmentLabel, markShipmentAsSent } from '../api/shipments.js';

export default function LabelsBatchPage() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const idsParam = searchParams.get('ids') || '';
  const ids = idsParam.split(',').map((s) => parseInt(s.trim(), 10)).filter(Boolean);

  const [labels, setLabels] = useState([]);      // [{ id, reference_id, labelPdf, error }]
  const [loading, setLoading] = useState(true);
  const [autoSentCount, setAutoSentCount] = useState(0);

  useEffect(() => {
    if (ids.length === 0) { setLoading(false); return; }

    async function load() {
      // טעינת כל המשלוחים במקביל
      const shipmentResults = await Promise.allSettled(ids.map((id) => getShipment(id)));

      // סינון מוצלחים
      let loadedShipments = shipmentResults
        .map((r, i) => r.status === 'fulfilled' ? r.value : null)
        .filter(Boolean);

      // סימון אוטומטי כ"נשלח" לממתינים
      const canMark = user.role === 'admin' || user.role === 'warehouse';
      let autoSent = 0;
      if (canMark) {
        loadedShipments = await Promise.all(
          loadedShipments.map(async (s) => {
            if (s.status !== 'pending') return s;
            try {
              const result = await markShipmentAsSent(s.id, 'print');
              if (!result.alreadySent) autoSent++;
              return result.shipment;
            } catch { return s; }
          })
        );
      }
      setAutoSentCount(autoSent);

      // משיכת כל המדבקות מאוריין במקביל
      const labelResults = await Promise.allSettled(
        loadedShipments.map((s) => getShipmentLabel(s.id))
      );

      const labelsData = loadedShipments.map((s, i) => {
        const r = labelResults[i];
        if (r.status === 'fulfilled') {
          return { id: s.id, reference_id: s.reference_id, labelPdf: r.value.label_pdf };
        }
        return { id: s.id, reference_id: s.reference_id, error: r.reason?.response?.data?.error || 'שגיאה' };
      });

      setLabels(labelsData);
      setLoading(false);
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsParam]);

  const successCount = labels.filter((l) => l.labelPdf).length;
  const failCount = labels.filter((l) => l.error).length;

  if (loading) {
    return <div className="max-w-2xl mx-auto px-4 py-8 text-center text-gray-500">טוען מדבקות מאוריין...</div>;
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

      {/* פס פעולה */}
      <div className="max-w-4xl mx-auto px-4 mb-4 flex gap-2 items-center print:hidden">
        <Link to="/shipments" className="btn-secondary">← חזרה לרשימה</Link>
        <div className="text-sm text-gray-600 mx-3">
          {successCount} מדבקות
          {failCount > 0 && <span className="text-red-600 mr-2">(נכשלו {failCount})</span>}
        </div>
        <button
          onClick={() => window.print()}
          disabled={successCount === 0}
          className="btn-primary mr-auto disabled:opacity-50"
        >
          🖨️ הדפסת כל המדבקות
        </button>
      </div>

      {autoSentCount > 0 && (
        <div className="max-w-4xl mx-auto px-4 mb-4 print:hidden">
          <div className="card bg-emerald-50 border-emerald-300 text-emerald-800 text-sm">
            ✓ {autoSentCount} משלוחים סומנו אוטומטית כ"נשלח"
          </div>
        </div>
      )}

      {/* מדבקות — iframe לכל משלוח */}
      <div className="max-w-4xl mx-auto px-4 print:p-0 space-y-6 print:space-y-0">
        {labels.map((label, i) => {
          const isLast = i === labels.length - 1;
          if (label.error) {
            return (
              <div key={label.id} className="card border-red-200 bg-red-50 text-red-700 print:hidden">
                משלוח {label.reference_id}: {label.error}
              </div>
            );
          }
          return (
            <div key={label.id} className={!isLast ? 'print:break-after-page' : ''}>
              <iframe
                src={label.labelPdf}
                title={`מדבקה ${label.reference_id}`}
                className="w-full border rounded bg-white"
                style={{ height: '70vh', minHeight: '400px' }}
              />
            </div>
          );
        })}
      </div>

      <style>{`
        @media print {
          @page { margin: 0; }
          body { background: white !important; }
          iframe { border: none !important; height: 100vh !important; }
        }
      `}</style>
    </div>
  );
}
