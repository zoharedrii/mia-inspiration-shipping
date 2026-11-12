// מסך "הזמנות איסוף" - לקוחות שבחרו לאסוף את ההזמנה מהסניף
//
// הפעולה הראשית: לאשר שהזמנה הגיעה לסניף. אפשר בשתי דרכים:
// 1. סריקת הברקוד שעל המדבקה (סורק ברקוד או מצלמת הטלפון)
// 2. לחיצה על "התקבל" ליד ההזמנה ברשימה
// אחרי האישור הלקוחה מקבלת SMS עם לינק, ולוחצת עליו כשהיא אוספת.

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { listPickupOrders, receivePickupOrder, handoverPickupOrder } from '../api/pickup.js';

// האם הדפדפן יודע לקרוא ברקוד מהמצלמה בלי ספרייה חיצונית (כרום באנדרואיד - כן, אייפון - לא)
const CAMERA_SCAN_SUPPORTED = typeof window !== 'undefined' && 'BarcodeDetector' in window;

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
        setMessage({
          type: 'success',
          text: `✅ הזמנה #${cleanNumber} של ${result.customer_name || 'הלקוחה'} התקבלה. נשלחה הודעה ללקוחה.`,
        });
      } else {
        await handoverPickupOrder(cleanNumber, pickupBranchId);
        setMessage({ type: 'success', text: `🎉 הזמנה #${cleanNumber} סומנה כנמסרה ללקוחה.` });
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
          סרקי את המדבקה או לחצי "התקבל" כשההזמנה מגיעה לסניף. הלקוחה תקבל הודעה מיד.
        </p>
      </header>

      {/* סריקה */}
      <form onSubmit={handleScanSubmit} className="card space-y-3">
        <label htmlFor="scan" className="block font-medium text-gray-800">
          סריקת מדבקה
        </label>
        <div className="flex gap-2">
          <input
            id="scan"
            ref={scanInputRef}
            autoFocus
            value={scanValue}
            onChange={(e) => setScanValue(e.target.value)}
            placeholder="סרקי או הקלידי מספר הזמנה"
            inputMode="numeric"
            className="flex-1 min-w-0 px-3 py-2.5 border border-gray-300 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       disabled:bg-gray-100"
            disabled={busyOrder !== null}
          />
          <button type="submit" className="btn-primary" disabled={!scanValue.trim() || busyOrder !== null}>
            אישור
          </button>
        </div>
        {CAMERA_SCAN_SUPPORTED && (
          <button type="button" onClick={() => setCameraOpen(true)} className="btn-secondary w-full">
            📷 סריקה במצלמה
          </button>
        )}
      </form>

      {cameraOpen && <CameraScanner onResult={handleCameraResult} onClose={() => setCameraOpen(false)} />}

      {/* הודעת משוב */}
      {message && (
        <div
          role="status"
          className={`rounded-lg px-4 py-3 text-sm font-medium ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
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
            buttonLabel="נמסרה ללקוחה"
            buttonClass="btn-secondary"
            onAction={(n) => runAction(n, 'handover')}
            note="אם הלקוחה אספה ולא לחצה על הלינק בהודעה, אפשר לסמן כאן."
          />
        </>
      )}
    </div>
  );
}

/**
 * רשימת הזמנות עם כפתור פעולה ליד כל אחת
 */
function OrdersSection({ title, emptyText, orders, showBranch, busyOrder, buttonLabel, buttonClass, onAction, note }) {
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
                <div className="font-medium text-gray-900">#{order.order_number}</div>
                <div className="text-sm text-gray-600 truncate">
                  {order.customer_name || 'ללא שם'}
                  {showBranch && order.branch_name ? ` · ${order.branch_name}` : ''}
                </div>
              </div>
              <button
                onClick={() => onAction(order.order_number)}
                className={`${buttonClass} shrink-0`}
                disabled={busyOrder !== null}
              >
                {busyOrder === order.order_number ? '…' : buttonLabel}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * סורק במצלמה - משתמש ב-BarcodeDetector שמובנה בדפדפן (בלי ספרייה).
 * פותח את המצלמה האחורית ובודק כמה פעמים בשנייה אם יש ברקוד בתמונה.
 */
function CameraScanner({ onResult, onClose }) {
  const videoRef = useRef(null);
  const [error, setError] = useState('');
  // שומרים את onResult ב-ref כדי שהמצלמה לא תיפתח מחדש בכל רינדור של המסך
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    let stream = null;
    let timer = null;
    let stopped = false;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (stopped) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        const detector = new window.BarcodeDetector({ formats: ['qr_code', 'code_128'] });
        timer = setInterval(async () => {
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0 && !stopped) {
              stopped = true;
              onResultRef.current(codes[0].rawValue);
            }
          } catch {
            // תמונה לא מוכנה עדיין - ממשיכים לנסות
          }
        }, 300);
      } catch {
        setError('לא הצלחנו לפתוח את המצלמה. בדקי שאישרת גישה למצלמה.');
      }
    }

    start();

    // ניקוי: עוצרים את המצלמה כשהחלון נסגר
    return () => {
      stopped = true;
      clearInterval(timer);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/80 z-20 flex flex-col items-center justify-center p-4 gap-4">
      {error ? (
        <p className="text-white text-center">{error}</p>
      ) : (
        <video ref={videoRef} className="w-full max-w-md rounded-lg" playsInline muted />
      )}
      <p className="text-white text-sm">כווני את המצלמה לברקוד שעל המדבקה</p>
      <button onClick={onClose} className="btn-secondary">
        סגירה
      </button>
    </div>
  );
}
