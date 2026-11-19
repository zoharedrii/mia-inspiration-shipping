// מסך "הזמנות איסוף" - לקוחות שבחרו לאסוף את ההזמנה מהסניף
//
// הפעולה הראשית: לאשר שהזמנה הגיעה לסניף. אפשר בשתי דרכים:
// 1. סריקת הברקוד שעל המדבקה (סורק ברקוד או מצלמת הטלפון)
// 2. לחיצה על "התקבל" ליד ההזמנה ברשימה
// ההזמנה עוברת ל"ממתינה ללקוחה". כשהלקוחה מגיעה, הסניף לוחץ "לקוחה אספה".
// (SMS ללקוחה כבוי כרגע - כשיופעל בשרת, ההודעות והתגיות של SMS יופיעו כאן אוטומטית.)

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { useAuth } from '../context/AuthContext.jsx';
import { listPickupOrders, receivePickupOrder, handoverPickupOrder, resendPickupSms } from '../api/pickup.js';

// טקסט ההודעה לסניף לפי מה שקרה עם ה-SMS ללקוחה
const SMS_RESULT_TEXT = {
  sent: 'נשלח SMS ללקוחה.',
  failed: '⚠️ שליחת ה-SMS ללקוחה נכשלה - אפשר לשלוח שוב מהרשימה.',
  no_phone: '⚠️ אין טלפון ללקוחה בהזמנה, לכן לא נשלח SMS. כדאי להתקשר אליה.',
};

// תגית קטנה ליד הזמנה שממתינה ללקוחה
const SMS_BADGE = {
  sent: { text: 'SMS נשלח', className: 'bg-green-50 text-green-700' },
  failed: { text: 'SMS נכשל', className: 'bg-orange-50 text-orange-700' },
  no_phone: { text: 'אין טלפון', className: 'bg-orange-50 text-orange-700' },
};

// האם יש לדפדפן גישה למצלמה (טלפון / מחשב עם מצלמה). הסריקה עצמה נעשית
// עם הספרייה html5-qrcode, שעובדת גם באייפון וגם באנדרואיד.
const CAMERA_AVAILABLE =
  typeof navigator !== 'undefined' && !!navigator.mediaDevices && !!navigator.mediaDevices.getUserMedia;

export default function PickupOrdersPage() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState(null); // { type: 'success' | 'error', text }
  const [busyOrder, setBusyOrder] = useState(null);
  const [scanValue, setScanValue] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const scanInputRef = useRef(null);

  async function loadOrders() {
    setLoadError('');
    try {
      const result = await listPickupOrders();
      setOrders(result);
    } catch (error) {
      setLoadError(error.response?.data?.error || 'שגיאה בטעינת ההזמנות');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, []);

  // מחזיר את שדה הסריקה לפוקוס - כדי שסורק ברקוד יעבוד מיד בלי ללחוץ על השדה
  function focusScanInput() {
    if (scanInputRef.current) {
      scanInputRef.current.focus();
    }
  }

  /**
   * מבצע פעולה (receive / handover) על הזמנה ומציג הודעה
   */
  async function runAction(orderNumber, action) {
    const cleanNumber = String(orderNumber).replace('#', '').trim();
    if (!cleanNumber) return;

    // מנהלת צריכה לשלוח את הסניף של ההזמנה - לוקחים אותו מהרשימה
    const order = orders.find((o) => o.order_number === cleanNumber);
    const pickupBranchId = isAdmin && order ? order.branch_id : undefined;
    if (isAdmin && !order) {
      setMessage({ type: 'error', text: `הזמנה #${cleanNumber} לא נמצאת ברשימה` });
      return;
    }

    setBusyOrder(cleanNumber);
    setMessage(null);
    try {
      if (action === 'receive') {
        const result = await receivePickupOrder(cleanNumber, pickupBranchId);
        const smsText = SMS_RESULT_TEXT[result.sms_status] || 'ממתינה ללקוחה.';
        const smsProblem = result.sms_status === 'failed' || result.sms_status === 'no_phone';
        setMessage({
          type: smsProblem ? 'warning' : 'success',
          text: `✅ הזמנה #${cleanNumber} של ${result.customer_name || 'הלקוחה'} התקבלה. ${smsText}`,
        });
      } else if (action === 'resend') {
        const result = await resendPickupSms(cleanNumber);
        setMessage({
          type: result.sms_status === 'sent' ? 'success' : 'warning',
          text: `הזמנה #${cleanNumber}: ${SMS_RESULT_TEXT[result.sms_status] || ''}`,
        });
      } else {
        await handoverPickupOrder(cleanNumber, pickupBranchId);
        setMessage({ type: 'success', text: `🎉 הזמנה #${cleanNumber}: הלקוחה אספה. ההזמנה נסגרה ונרשמה בשופיפיי.` });
      }
      await loadOrders();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'הפעולה נכשלה, נסי שוב' });
    } finally {
      setBusyOrder(null);
      focusScanInput();
    }
  }

  // סורק ברקוד "מקליד" את המספר ולוחץ Enter - לכן מספיק לטפל בשליחת הטופס
  function handleScanSubmit(event) {
    event.preventDefault();
    const value = scanValue;
    setScanValue('');
    runAction(value, 'receive');
  }

  function handleCameraResult(value) {
    setCameraOpen(false);
    runAction(value, 'receive');
  }

  const inTransit = orders.filter((o) => o.status === 'in_transit');
  const waiting = orders.filter((o) => o.status === 'waiting_pickup');

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">הזמנות איסוף</h1>
        <p className="text-gray-600 mt-1 text-sm">
          סרקי את המדבקה או לחצי "התקבל" כשההזמנה מגיעה לסניף. כשהלקוחה אוספת - לחצי "לקוחה אספה".
        </p>
      </header>

      {/* סריקה */}
      <form onSubmit={handleScanSubmit} className="card space-y-3">
        <label htmlFor="scan" className="block font-medium text-gray-800">
          סריקת מדבקה
        </label>
        <div className="flex gap-2">
          {/* שורת החיפוש, עם כפתור מצלמה בתוכה (בצד שמאל) */}
          <div className="relative flex-1 min-w-0">
            <input
              id="scan"
              ref={scanInputRef}
              autoFocus
              value={scanValue}
              onChange={(e) => setScanValue(e.target.value)}
              placeholder="סרקי או הקלידי מספר הזמנה"
              inputMode="numeric"
              className={`w-full px-3 py-2.5 border border-gray-300 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         disabled:bg-gray-100 ${CAMERA_AVAILABLE ? 'pl-12' : ''}`}
              disabled={busyOrder !== null}
            />
            {CAMERA_AVAILABLE && (
              <button
                type="button"
                onClick={() => setCameraOpen(true)}
                disabled={busyOrder !== null}
                aria-label="סריקת QR במצלמה"
                title="סריקת QR במצלמה"
                className="absolute left-1 top-1/2 -translate-y-1/2 p-2 rounded-md text-xl
                           hover:bg-gray-100 disabled:opacity-40"
              >
                📷
              </button>
            )}
          </div>
          <button type="submit" className="btn-primary" disabled={!scanValue.trim() || busyOrder !== null}>
            אישור
          </button>
        </div>
      </form>

      {cameraOpen && <CameraScanner onResult={handleCameraResult} onClose={() => setCameraOpen(false)} />}

      {/* הודעת משוב */}
      {message && (
        <div
          role="status"
          className={`rounded-lg px-4 py-3 text-sm font-medium ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : message.type === 'warning'
                ? 'bg-orange-50 text-orange-800 border border-orange-200'
                : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {loading && <p className="text-gray-500">טוען הזמנות…</p>}
      {loadError && <p className="text-red-700">{loadError}</p>}

      {!loading && !loadError && (
        <>
          <OrdersSection
            title="בדרך לסניף"
            emptyText="אין כרגע הזמנות בדרך לסניף"
            orders={inTransit}
            showBranch={isAdmin}
            busyOrder={busyOrder}
            buttonLabel="התקבל"
            buttonClass="btn-primary"
            onAction={(n) => runAction(n, 'receive')}
          />
          <OrdersSection
            title="ממתינות ללקוחה"
            emptyText="אין הזמנות שממתינות לאיסוף"
            orders={waiting}
            showBranch={isAdmin}
            busyOrder={busyOrder}
            buttonLabel="לקוחה אספה"
            buttonClass="btn-primary"
            onAction={(n) => runAction(n, 'handover')}
            onResendSms={(n) => runAction(n, 'resend')}
            showSmsStatus
          />
        </>
      )}
    </div>
  );
}

/**
 * רשימת הזמנות עם כפתור פעולה ליד כל אחת
 */
function OrdersSection({
  title,
  emptyText,
  orders,
  showBranch,
  busyOrder,
  buttonLabel,
  buttonClass,
  onAction,
  onResendSms,
  showSmsStatus,
  note,
}) {
  return (
    <section className="space-y-2">
      <h2 className="font-bold text-gray-900">
        {title} <span className="text-gray-500 font-normal">({orders.length})</span>
      </h2>
      {note && orders.length > 0 && <p className="text-xs text-gray-500">{note}</p>}
      {orders.length === 0 ? (
        <p className="text-sm text-gray-500 card">{emptyText}</p>
      ) : (
        <ul className="space-y-2">
          {orders.map((order) => (
            <li key={order.order_number} className="card flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                {/* סדר התצוגה: שם לקוחה, טלפון, מספר הזמנה */}
                <div className="font-medium text-gray-900 truncate">{order.customer_name || 'ללא שם'}</div>
                {order.customer_phone ? (
                  <a href={`tel:${order.customer_phone}`} className="block text-sm text-blue-700 text-right" dir="ltr">
                    {order.customer_phone}
                  </a>
                ) : (
                  <div className="text-sm text-gray-400">אין טלפון</div>
                )}
                <div className="text-sm text-gray-600">
                  #{order.order_number}
                  {showBranch && order.branch_name ? ` · ${order.branch_name}` : ''}
                </div>
                {showSmsStatus && SMS_BADGE[order.sms_status] && (
                  <span
                    className={`inline-block mt-1 text-xs rounded px-2 py-0.5 ${SMS_BADGE[order.sms_status].className}`}
                  >
                    {SMS_BADGE[order.sms_status].text}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <button
                  onClick={() => onAction(order.order_number)}
                  className={buttonClass}
                  disabled={busyOrder !== null}
                >
                  {busyOrder === order.order_number ? '…' : buttonLabel}
                </button>
                {onResendSms && order.sms_status === 'failed' && (
                  <button
                    onClick={() => onResendSms(order.order_number)}
                    className="text-xs text-blue-700 underline"
                    disabled={busyOrder !== null}
                  >
                    שלח SMS שוב
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * סורק QR במצלמה - משתמש בספרייה html5-qrcode (עובדת באייפון ובאנדרואיד).
 * פותח את המצלמה האחורית, וכשה-QR שעל המדבקה מזוהה מחזיר את מספר ההזמנה
 * (ה-QR במדבקה מכיל רק את מספר ההזמנה).
 */
const SCANNER_ELEMENT_ID = 'pickup-qr-reader';

function CameraScanner({ onResult, onClose }) {
  const [error, setError] = useState('');
  // שומרים את onResult ב-ref כדי שהמצלמה לא תיפתח מחדש בכל רינדור של המסך
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, {
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE, Html5QrcodeSupportedFormats.CODE_128],
      verbose: false,
    });
    let running = false;
    let done = false;

    // עוצר את המצלמה (בטוח לקרוא גם אם היא כבר נעצרה)
    async function stopCamera() {
      if (running) {
        running = false;
        try {
          await scanner.stop();
          scanner.clear();
        } catch {
          // המצלמה כבר נסגרה
        }
      }
    }

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => {
          if (done) return;
          done = true;
          stopCamera();
          onResultRef.current(decodedText);
        },
        () => {
          // לא זוהה קוד בתמונה הזו - ממשיכים לנסות
        }
      )
      .then(() => {
        running = true;
        // אם החלון נסגר בזמן שהמצלמה נפתחה
        if (done) stopCamera();
      })
      .catch(() => {
        setError('לא הצלחנו לפתוח את המצלמה. בדקי שאישרת גישה למצלמה.');
      });

    // ניקוי: עוצרים את המצלמה כשהחלון נסגר
    return () => {
      done = true;
      stopCamera();
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/80 z-20 flex flex-col items-center justify-center p-4 gap-4">
      {error && <p className="text-white text-center">{error}</p>}
      <div id={SCANNER_ELEMENT_ID} className="w-full max-w-md rounded-lg overflow-hidden bg-black" />
      <p className="text-white text-sm">כווני את המצלמה ל-QR שעל המדבקה</p>
      <button onClick={onClose} className="btn-secondary">
        סגירה
      </button>
    </div>
  );
}
