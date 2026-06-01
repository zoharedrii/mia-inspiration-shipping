// מסך מדבקת שילוח — מושך PDF מ-API של אוריין ומציג להדפסה

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getShipment, getShipmentLabel, markShipmentAsSent, canPrintLabel } from '../api/shipments.js';

export default function LabelPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [shipment, setShipment] = useState(null);
  const [labelPdfs, setLabelPdfs] = useState([]);  // מערך — להזמנה עם כמה חבילות יש כמה מדבקות
  const [loading, setLoading] = useState(true);
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

        // חשוב: אוריין מאפשרת למשוך מדבקה רק כשההזמנה במצב "חדש".
        // לכן מושכים את המדבקה *קודם*, ורק אחריה מסמנים "נשלח".
        const labelData = await getShipmentLabel(id);
        // תמיכה במערך מדבקות (label_pdfs) עם נפילה-לאחור למדבקה בודדת
        const pdfs = labelData.label_pdfs || (labelData.label_pdf ? [labelData.label_pdf] : []);
        setLabelPdfs(pdfs);

        // סימון אוטומטי כ"נשלח" — רק אחרי שהמדבקה נמשכה בהצלחה
        if (data.status === 'pending' && (user.role === 'admin' || user.role === 'warehouse')) {
          const result = await markShipmentAsSent(id, 'print');
          data = result.shipment;
          if (!result.alreadySent) setAutoSentNotice(true);
        }

        setShipment(data);

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

  if (error || labelPdfs.length === 0) {
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
        {labelPdfs.length > 1 && (
          <div className="text-sm text-gray-600 mx-3">{labelPdfs.length} מדבקות</div>
        )}
        <button onClick={() => window.print()} className="btn-primary mr-auto">
          🖨️ הדפסה
        </button>
      </div>

      {/* מדבקות אוריין — iframe לכל חבילה */}
      <div className="max-w-4xl mx-auto px-4 space-y-6 print:space-y-0">
        {labelPdfs.map((pdf, i) => (
          <iframe
            key={i}
            src={pdf}
            title={`מדבקת שילוח אוריין ${i + 1}`}
            className={'w-full border rounded bg-white ' + (i < labelPdfs.length - 1 ? 'print:break-after-page' : '')}
            style={{ height: '90vh', minHeight: '600px' }}
          />
        ))}
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
