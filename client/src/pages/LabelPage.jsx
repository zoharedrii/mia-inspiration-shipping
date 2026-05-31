// מסך מדבקת שילוח — מושך PDF מ-API של אוריין ומציג להדפסה

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getShipment, getShipmentLabel, markShipmentAsSent, canPrintLabel } from '../api/shipments.js';

export default function LabelPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [shipment, setShipment] = useState(null);
  const [labelPdf, setLabelPdf] = useState(null);
  const [loading, setLoading] = useState(true);
  const [iframeLoading, setIframeLoading] = useState(true);
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

        // משיכת מדבקה מאוריין
        const labelData = await getShipmentLabel(id);
        setLabelPdf(labelData.label_pdf);

      } catch (err) {
        const msg = err.response?.data?.error || err.message || 'שגיאה בטעינת המדבקה';
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center text-gray-500">
        טוען מדבקה מאוריין...
      </div>
    );
  }

  if (error || !labelPdf) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <div className="card border-red-200 bg-red-50 text-red-700">
          {error || 'לא ניתן לטעון את המדבקה'}
        </div>
        <Link to={`/shipments/${id}`} className="btn-secondary inline-block">
          ← חזרה לפרטי משלוח
        </Link>
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
        {autoSentNotice && (
          <div className="text-sm text-emerald-700 mx-3">
            ✓ המשלוח סומן כ"נשלח"
          </div>
        )}
        <button onClick={() => window.print()} className="btn-primary mr-auto">
          🖨️ הדפסה
        </button>
      </div>

      {/* מדבקת אוריין */}
      <div className="max-w-4xl mx-auto px-4 relative">
        {iframeLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded z-10">
            <div className="text-center text-gray-500">
              <div className="text-3xl mb-2 animate-bounce">📄</div>
              <div>טוען מדבקה...</div>
            </div>
          </div>
        )}
        <iframe
          src={labelPdf}
          title="מדבקת שילוח אוריין"
          className="w-full border rounded bg-white"
          style={{ height: '90vh', minHeight: '600px' }}
          onLoad={() => setIframeLoading(false)}
        />
      </div>

      <style>{`
        @media print {
          @page { margin: 0; }
          body { background: white !important; }
          iframe { border: none !important; }
        }
      `}</style>
    </div>
  );
}
