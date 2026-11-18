// מסך סריקת חבילות לאיסוף מסניף
//
// הסטייליסטית סורקת את ה-QR שעל מדבקת האיסוף של כל חבילה שהגיעה לסניף.
// כל סריקה נשלחת לשרת → למערכת האיסוף, שמשנה סטטוס ל"מחכה לאיסוף"
// ושולחת ללקוחה הודעה בפלאשי.
//
// סריקה רציפה: המצלמה נשארת פתוחה, אפשר לסרוק חבילה אחרי חבילה.
// אותו קוד לא נשלח פעמיים ברצף (כשהמצלמה עדיין מכוונת לאותה מדבקה).
// אם אין מצלמה / המדבקה לא נקראת — יש שדה להקלדה ידנית.

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { scanPickupOrder } from '../api/pickup.js';

// כמה זמן (במילישניות) מתעלמים מאותו קוד אחרי שנסרק
const SAME_CODE_COOLDOWN_MS = 4000;

// צבע לכל סוג תוצאה
const RESULT_STYLES = {
  arrived:      { box: 'bg-green-50 border-green-300 text-green-900',  icon: '✅' },
  wrong_branch: { box: 'bg-orange-50 border-orange-300 text-orange-900', icon: '⚠️' },
  wrong_status: { box: 'bg-amber-50 border-amber-300 text-amber-900',  icon: '⚠️' },
  not_found:    { box: 'bg-red-50 border-red-300 text-red-900',        icon: '❌' },
  error:        { box: 'bg-red-50 border-red-300 text-red-900',        icon: '❌' },
};

export default function PickupScanPage() {
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [manualValue, setManualValue] = useState('');
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState([]); // הסריקות של הסשן הנוכחי, החדשה למעלה

  const scannerRef = useRef(null);
  const lastCodeRef = useRef({ code: '', at: 0 });

  // שליחת מספר הזמנה לשרת והוספת התוצאה לרשימה
  async function submitOrder(orderNumber) {
    const value = String(orderNumber || '').trim();
    if (!value) return;

    setSending(true);
    let result;
    try {
      result = await scanPickupOrder(value);
    } catch (error) {
      result = {
        ok: false,
        code: 'error',
        message: error.response?.data?.error || 'שגיאה בחיבור לשרת, נסי שוב',
        order_number: value,
      };
    }
    setSending(false);

    // רטט קצר בטלפון — ארוך יותר כשיש בעיה
    if (navigator.vibrate) navigator.vibrate(result.ok ? 80 : [150, 80, 150]);

    setResults((prev) => [{ ...result, at: new Date() }, ...prev].slice(0, 30));
  }

  // נקרא בכל פעם שהמצלמה מזהה QR
  function onCodeDetected(decodedText) {
    const now = Date.now();
    const last = lastCodeRef.current;
    if (decodedText === last.code && now - last.at < SAME_CODE_COOLDOWN_MS) {
      return; // אותה מדבקה עדיין מול המצלמה
    }
    lastCodeRef.current = { code: decodedText, at: now };
    submitOrder(decodedText);
  }

  // הפעלה / כיבוי של המצלמה
  useEffect(() => {
    if (!cameraOn) return undefined;

    const scanner = new Html5Qrcode('pickup-reader');
    scannerRef.current = scanner;
    setCameraError('');

    scanner
      .start(
        { facingMode: 'environment' }, // מצלמה אחורית
        { fps: 10, qrbox: { width: 240, height: 240 } },
        onCodeDetected,
        () => {} // פריים בלי QR — מתעלמים
      )
      .catch(() => {
        setCameraError('לא הצלחנו לפתוח את המצלמה. אפשר להקליד את מספר ההזמנה למטה.');
        setCameraOn(false);
      });

    // כשיוצאים מהמסך או מכבים — עוצרים את המצלמה
    return () => {
      if (scanner.isScanning) {
        scanner.stop().then(() => scanner.clear()).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOn]);

  function handleManualSubmit(event) {
    event.preventDefault();
    submitOrder(manualValue);
    setManualValue('');
  }

  const arrivedCount = results.filter((r) => r.ok).length;

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">סריקת חבילות לאיסוף</h1>
        <p className="text-gray-600 mt-1 text-sm">
          סרקי את ה-QR שעל המדבקה של כל חבילה שהגיעה לסניף. הלקוחה תקבל הודעה שהחבילה מחכה לה.
        </p>
      </header>

      {/* מצלמה */}
      <div className="card space-y-3">
        <div
          id="pickup-reader"
          className={`w-full overflow-hidden rounded-xl bg-black ${cameraOn ? '' : 'hidden'}`}
        />

        {cameraOn ? (
          <button onClick={() => setCameraOn(false)} className="btn-secondary w-full">
            סגירת מצלמה
          </button>
        ) : (
          <button onClick={() => setCameraOn(true)} className="btn-primary w-full text-lg py-4">
            📷 פתיחת מצלמה לסריקה
          </button>
        )}

        {cameraError && <p className="text-sm text-red-700">{cameraError}</p>}
      </div>

      {/* הקלדה ידנית */}
      <form onSubmit={handleManualSubmit} className="card flex gap-2 items-end">
        <label className="flex-1">
          <span className="block text-sm font-medium text-gray-700 mb-1">או הקלדת מספר הזמנה</span>
          <input
            type="text"
            inputMode="numeric"
            value={manualValue}
            onChange={(e) => setManualValue(e.target.value)}
            placeholder="לדוגמה: 15234"
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={sending || !manualValue.trim()}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          שליחה
        </button>
      </form>

      {sending && <p className="text-center text-gray-500 text-sm">שולחת…</p>}

      {/* תוצאות */}
      {results.length > 0 && (
        <section className="space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>נסרקו בסשן הזה: {results.length}</span>
            <span>התקבלו בסניף: {arrivedCount}</span>
          </div>

          {results.map((r, index) => {
            const style = RESULT_STYLES[r.code] || RESULT_STYLES.error;
            return (
              <div
                key={`${r.order_number}-${r.at.getTime()}-${index}`}
                className={`rounded-xl border p-3 ${style.box} ${index === 0 ? 'text-base' : 'text-sm opacity-80'}`}
              >
                <div className="flex justify-between gap-2 font-bold">
                  <span>
                    {style.icon} הזמנה {r.order_number}
                    {r.customer_name ? ` · ${r.customer_name}` : ''}
                  </span>
                  <span className="font-normal text-xs">
                    {r.at.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="mt-1">{r.message}</div>
              </div>
            );
          })}
        </section>
      )}

      <Link to="/" className="btn-secondary block text-center">
        חזרה למסך הבית
      </Link>
    </div>
  );
}
