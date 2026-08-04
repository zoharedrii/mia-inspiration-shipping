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
  const [failed, setFailed] = useState([]);           // משלוחים שהמדבקה שלהם נכשלה: [{ ref, msg }]
  const [loading, setLoading] = useState(true);
  const [autoSentCount, setAutoSentCount] = useState(0);
  const [progress, setProgress] = useState({ done: 0, total: 0 }); // התקדמות משיכת המדבקות
  const iframeRef = useRef(null);

  useEffect(() => {
    if (ids.length === 0) { setLoading(false); return; }

    async function load() {
      // 1. טעינת כל המשלוחים במקביל
      const shipmentResults = await Promise.allSettled(ids.map((id) => getShipment(id)));
      const loadedShipments = shipmentResults
        .map((r) => (r.status === 'fulfilled' ? r.value : null))
        .filter(Boolean);

      // 2+3. משיכת המדבקות מאוריין — אחת-אחרי-השנייה (סדרתי!), לא במקביל.
      //    חשוב: משיכה של הרבה מדבקות במקביל מעמיסה על אוריין וגורמת לחלק
      //    מהבקשות להיכשל אקראית (וגם יוצרת "מרוץ" על טוקן ההתחברות).
      //    לכן מושכים בזו אחר זו — איטי מעט יותר, אבל אמין. כל מדבקה מנסים עד פעמיים.
      const allBase64 = [];
      const failedList = [];
      setProgress({ done: 0, total: loadedShipments.length });

      for (let i = 0; i < loadedShipments.length; i++) {
        const s = loadedShipments[i];
        let data = null;
        let lastErr = 'לא התקבלה מדבקה';

        for (let attempt = 0; attempt < 2 && !data; attempt++) {
          try {
            data = await getShipmentLabel(s.id);
          } catch (err) {
            lastErr = err?.response?.data?.error || 'שגיאה לא ידועה';
          }
        }

        const list = data
          ? (data.label_base64_list || (data.label_base64 ? [data.label_base64] : []))
          : [];

        if (list.length > 0) {
          allBase64.push(...list);
        } else {
          failedList.push({
            ref: s.reference_id,
            source: s.source_branch_name,
            target: s.target_branch_name,
            msg: (data && data.error) || lastErr,
          });
        }
        setProgress({ done: i + 1, total: loadedShipments.length });
      }

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
      setFailed(failedList);

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
      <div className="max-w-2xl mx-auto px-4 py-8 text-center text-gray-500 space-y-2">
        <div>טוען ומאחד מדבקות מאוריין...</div>
        {progress.total > 0 && (
          <div className="text-sm text-gray-400">
            מדבקה {progress.done} מתוך {progress.total}
          </div>
        )}
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
          {failed.length > 0 && (
            <span className="text-red-600 mr-2">(נכשלו {failed.length})</span>
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

      {/* הודעה על מדבקות שנכשלו (אם יש) — עם הסבר לסיבה הנפוצה */}
      {failed.length > 0 && (
        <div className="max-w-4xl mx-auto px-4 mb-4">
          <div className="card border-amber-200 bg-amber-50 text-amber-900 text-sm space-y-2">
            <div className="font-medium">
              לא התקבלו מדבקות עבור {failed.length} משלוחים:
            </div>
            <ul className="list-disc pr-5 space-y-1">
              {failed.map((f) => (
                <li key={f.ref}>
                  <span className="font-mono">{f.ref}</span>
                  {(f.source || f.target) && (
                    <span className="text-amber-800">
                      {' '}— מאת: <strong>{f.source || '—'}</strong> ← אל: <strong>{f.target || '—'}</strong>
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <div className="text-xs text-amber-800 border-t border-amber-200 pt-2">
              💡 בדרך כלל הסיבה: <strong>המדבקה כבר הודפסה בעבר</strong>, או שהמשלוח כבר נשלח/נמסר.
              אוריין מאפשרת למשוך מדבקה רק כשההזמנה עדיין <strong>"חדשה"</strong> (לפני השליחה).
            </div>
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
