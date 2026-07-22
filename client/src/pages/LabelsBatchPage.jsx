// מסך מדבקות מרובות - מושך PDF מאוריין ומאחד את כולן למסמך PDF אחד להדפסה.
//
// URL: /shipments/labels?ids=1,2,3
//
// למה איחוד? אוריין מחזירה מדבקה נפרדת לכל הזמנה. במקום להציג ולהדפיס כל קובץ
// בנפרד (מה שהדפדפן מתקשה איתו), אנחנו מאחדים את כל המדבקות למסמך PDF יחיד
// בעזרת הספרייה pdf-lib — כך שהדפסה אחת מדפיסה את כל המדבקות ברצף.

import { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getShipment, getShipmentLabel, markShipmentAsSent } from '../api/shipments.js';
import { PDFDocument } from 'pdf-lib';

// ממיר מחרוזת base64 למערך בייטים (Uint8Array) — הפורמט ש-pdf-lib מקבל
function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export default function LabelsBatchPage() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const idsParam = searchParams.get('ids') || '';
  const ids = idsParam.split(',').map((s) => parseInt(s.trim(), 10)).filter(Boolean);

  const [mergedUrl, setMergedUrl] = useState(null);   // blob URL של ה-PDF המאוחד
  const [pageCount, setPageCount] = useState(0);      // כמה עמודי מדבקות אוחדו
  const [failedRefs, setFailedRefs] = useState([]);   // מספרי משלוחים שהמדבקה שלהם נכשלה
  const [loading, setLoading] = useState(true);
  const [autoSentCount, setAutoSentCount] = useState(0);
  const iframeRef = useRef(null);

  useEffect(() => {
    if (ids.length === 0) { setLoading(false); return; }

    async function load() {
      // 1. טעינת כל המשלוחים במקביל
      const shipmentResults = await Promise.allSettled(ids.map((id) => getShipment(id)));
      const loadedShipments = shipmentResults
        .map((r) => (r.status === 'fulfilled' ? r.value : null))
        .filter(Boolean);

      // 2. משיכת המדבקות מאוריין — לפני סימון "נשלח"
      //    (אוריין מאפשרת למשוך מדבקה רק כשההזמנה עדיין במצב "חדש")
      const labelResults = await Promise.allSettled(
        loadedShipments.map((s) => getShipmentLabel(s.id))
      );

      // 3. איסוף כל מחרוזות ה-base64 של המדבקות + רישום כשלונות
      const allBase64 = [];
      const failed = [];
      labelResults.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          const list = r.value.label_base64_list
            || (r.value.label_base64 ? [r.value.label_base64] : []);
          allBase64.push(...list);
        } else {
          failed.push(loadedShipments[i].reference_id);
        }
      });

      // 4. איחוד כל המדבקות למסמך PDF אחד
      if (allBase64.length > 0) {
        const mergedPdf = await PDFDocument.create();
        for (const b64 of allBase64) {
          try {
            const src = await PDFDocument.load(base64ToBytes(b64), { ignoreEncryption: true });
            const pages = await mergedPdf.copyPages(src, src.getPageIndices());
            pages.forEach((p) => mergedPdf.addPage(p));
          } catch {
            // מדבקה בודדת שלא ניתן היה לאחד — מדלגים עליה בלי להפיל את השאר
          }
        }
        const mergedBytes = await mergedPdf.save();
        const blob = new Blob([mergedBytes], { type: 'application/pdf' });
        setMergedUrl(URL.createObjectURL(blob));
        setPageCount(mergedPdf.getPageCount());
      }
      setFailedRefs(failed);

      // 5. סימון אוטומטי כ"נשלח" לממתינים — רק admin/warehouse, ורק אחרי משיכת המדבקות
      const canMark = user.role === 'admin' || user.role === 'warehouse';
      let autoSent = 0;
      if (canMark) {
        await Promise.all(
          loadedShipments.map(async (s) => {
            if (s.status !== 'pending') return;
            try {
              const result = await markShipmentAsSent(s.id, 'print');
              if (!result.alreadySent) autoSent++;
            } catch { /* לא קריטי — המדבקה כבר נמשכה */ }
          })
        );
      }
      setAutoSentCount(autoSent);
      setLoading(false);
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsParam]);

  // הדפסה: מדפיסים ישירות את ה-PDF המאוחד שבתוך ה-iframe (מסמך אחד = הדפסה אחת)
  function handlePrint() {
    const frame = iframeRef.current;
    if (frame && frame.contentWindow) {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } else {
      window.print();
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center text-gray-500">
        טוען ומאחד מדבקות מאוריין...
      </div>
    );
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
    <div className="bg-gray-100 min-h-screen py-8">
      {/* פס פעולה */}
      <div className="max-w-4xl mx-auto px-4 mb-4 flex flex-wrap gap-2 items-center">
        <Link to="/shipments" className="btn-secondary">← חזרה לרשימה</Link>
        <div className="text-sm text-gray-600 mx-3">
          {pageCount} עמודי מדבקות במסמך אחד
          {failedRefs.length > 0 && (
            <span className="text-red-600 mr-2">(נכשלו {failedRefs.length})</span>
          )}
        </div>
        {mergedUrl && (
          <>
            <a
              href={mergedUrl}
              download="מדבקות-משלוחים.pdf"
              className="btn-secondary"
            >
              💾 הורדת קובץ מאוחד
            </a>
            <button onClick={handlePrint} className="btn-primary mr-auto">
              🖨️ הדפסת כל המדבקות
            </button>
          </>
        )}
      </div>

      {autoSentCount > 0 && (
        <div className="max-w-4xl mx-auto px-4 mb-4">
          <div className="card bg-emerald-50 border-emerald-300 text-emerald-800 text-sm">
            ✓ {autoSentCount} משלוחים סומנו אוטומטית כ"נשלח"
          </div>
        </div>
      )}

      {/* הודעה על מדבקות שנכשלו (אם יש) */}
      {failedRefs.length > 0 && (
        <div className="max-w-4xl mx-auto px-4 mb-4">
          <div className="card border-red-200 bg-red-50 text-red-700 text-sm">
            לא ניתן היה למשוך מדבקה עבור: {failedRefs.join(', ')}
          </div>
        </div>
      )}

      {/* מסמך PDF אחד מאוחד עם כל המדבקות */}
      {mergedUrl ? (
        <div className="max-w-4xl mx-auto px-4">
          <iframe
            ref={iframeRef}
            src={mergedUrl}
            title="כל המדבקות במסמך אחד"
            className="w-full border rounded bg-white"
            style={{ height: '80vh', minHeight: '500px' }}
          />
        </div>
      ) : (
        <div className="max-w-2xl mx-auto px-4">
          <div className="card border-red-200 bg-red-50 text-red-700">
            לא התקבלו מדבקות מאוריין עבור המשלוחים שנבחרו.
          </div>
        </div>
      )}
    </div>
  );
}
