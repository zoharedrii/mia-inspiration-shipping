// מסך מדבקת שילוח
//
// בסביבת live: מושך PDF מ-API של אוריין ומציג אותו בדפדפן
// בסביבת mock: מציג מדבקה מקומית (HTML) עם ברקוד

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getShipment, getShipmentLabel, markShipmentAsSent, canPrintLabel } from '../api/shipments.js';
import ShippingLabel from '../components/ShippingLabel.jsx';

export default function LabelPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [shipment, setShipment] = useState(null);
  const [labelPdf, setLabelPdf] = useState(null);   // data URL של PDF מאוריין
  const [isMockMode, setIsMockMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [labelLoading, setLabelLoading] = useState(false);
  const [error, setError] = useState('');
  const [autoSentNotice, setAutoSentNotice] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        let data = await getShipment(id);

        if (!canPrintLabel(data)) {
          setError('לא ניתן להדפיס מדבקה למשלוח בסטטוס "' +
            (data.status === 'cancelled' ? 'בוטל' : 'לא התקבל') + '"');
          return;
        }

        // סימון אוטומטי כ"נשלח" בעת הדפסה
        if (data.status === 'pending' && (user.role === 'admin' || user.role === 'warehouse')) {
          const result = await markShipmentAsSent(id, 'print');
          data = result.shipment;
          if (!result.alreadySent) setAutoSentNotice(true);
        }

        setShipment(data);

        // ניסיון לטעון מדבקה מאוריין
        setLabelLoading(true);
        try {
          const labelData = await getShipmentLabel(id);
          setLabelPdf(labelData.label_pdf);
        } catch (labelErr) {
          // מצב mock או שגיאה — נציג מדבקה מקומית
          setIsMockMode(true);
        } finally {
          setLabelLoading(false);
        }

      } catch (err) {
        setError(err.response?.data?.error || 'לא ניתן לטעון את המשלוח');
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return <div className="max-w-2xl mx-auto px-4 py-8 text-center text-gray-500">טוען...</div>;
  }

  if (error || !shipment) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <div className="card border-red-200 bg-red-50 text-red-700">{error || 'המשלוח לא נמצא'}</div>
        <Link to={`/shipments/${id}`} className="btn-secondary inline-block">חזרה לפרטי משלוח</Link>
      </div>
    );
  }

  return (
    <div className="bg-gray-100 min-h-screen py-8 print:bg-white print:py-0">

      {/* פס פעולה */}
      <div className="max-w-4xl mx-auto px-4 mb-4 flex gap-2 items-center print:hidden">
        <Link to={`/shipments/${id}`} className="btn-secondary">
          ← חזרה לפרטי משלוח
        </Link>
        <div className="text-sm text-gray-600 mx-3">
          {shipment.package_count} מארזים
        </div>
        {/* כפתור הדפסה — מודפסת בהתאם למה שמוצג */}
        <button onClick={() => window.print()} className="btn-primary mr-auto">
          🖨️ הדפסה
        </button>
      </div>

      {/* הודעה על סימון אוטומטי כנשלח */}
      {autoSentNotice && (
        <div className="max-w-4xl mx-auto px-4 mb-4 print:hidden">
          <div className="card bg-emerald-50 border-emerald-300 text-emerald-800 text-sm">
            ✓ המשלוח סומן אוטומטית כ"נשלח". הסניף המקבל יראה אותו ברשימה.
          </div>
        </div>
      )}

      {labelLoading && (
        <div className="max-w-4xl mx-auto px-4 mb-4 print:hidden text-gray-500 text-sm text-center">
          טוען מדבקה מאוריין...
        </div>
      )}

      {/* === מדבקת אוריין (live) — PDF באיפריים === */}
      {labelPdf && (
        <div className="max-w-4xl mx-auto px-4">
          <div className="mb-3 print:hidden text-sm text-emerald-700 font-medium text-center">
            ✅ מדבקה רשמית מאוריין
          </div>
          <iframe
            src={labelPdf}
            title="מדבקת שילוח אוריין"
            className="w-full border rounded"
            style={{ height: '90vh', minHeight: '600px' }}
          />
        </div>
      )}

      {/* === מדבקה מקומית (mock fallback) === */}
      {!labelPdf && !labelLoading && isMockMode && (
        <>
          <div className="max-w-4xl mx-auto px-4 mb-3 print:hidden">
            <div className="card bg-amber-50 border-amber-200 text-amber-800 text-sm text-center">
              📋 מדבקה מקומית (סביבת בדיקות) — בפרודקשן תוצג מדבקה רשמית מאוריין
            </div>
          </div>
          <div className="px-4 print:p-0 space-y-8 print:space-y-0">
            {Array.from({ length: shipment.package_count }, (_, i) => {
              const isLast = i === shipment.package_count - 1;
              return (
                <div key={i} className={!isLast ? 'print:break-after-page' : ''}>
                  <ShippingLabel
                    shipment={shipment}
                    packageIndex={i + 1}
                    totalPackages={shipment.package_count}
                  />
                </div>
              );
            })}
          </div>
        </>
      )}

      <style>{`
        @media print {
          @page { size: A6 landscape; margin: 5mm; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}
