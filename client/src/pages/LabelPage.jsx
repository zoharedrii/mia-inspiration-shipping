// מסך מדבקה בודדת - מציג ומדפיס מדבקה אחת
//
// בלחיצה על "הדפסה" נפתח דיאלוג ההדפסה של הדפדפן.
// בהדפסה כל ה-UI הניהולי נעלם, נשארת רק המדבקה.

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getShipment } from '../api/shipments.js';
import ShippingLabel from '../components/ShippingLabel.jsx';

export default function LabelPage() {
  const { id } = useParams();
  const [shipment, setShipment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getShipment(id)
      .then(setShipment)
      .catch((err) => setError(err.response?.data?.error || 'לא ניתן לטעון את המשלוח'))
      .finally(() => setLoading(false));
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
      {/* פס פעולה - מוסתר בהדפסה */}
      <div className="max-w-2xl mx-auto px-4 mb-4 flex gap-2 items-center print:hidden">
        <Link to={`/shipments/${id}`} className="btn-secondary">
          ← חזרה לפרטי משלוח
        </Link>
        <div className="text-sm text-gray-600 mx-3">
          {shipment.package_count} מדבקות
        </div>
        <button onClick={() => window.print()} className="btn-primary mr-auto">
          🖨️ הדפסה
        </button>
      </div>

      {/* כל המדבקות זו אחר זו (לפי כמות המארזים) */}
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

        <div className="text-center text-xs text-gray-500 mt-4 print:hidden">
          מערכת מייה אינספיריישן — מדבקה בסגנון אוריין (Mock).
          <br />
          במצב live: מדבקה תימשך מאוריין דרך <code>GetTransportationOrderLabel</code>.
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
