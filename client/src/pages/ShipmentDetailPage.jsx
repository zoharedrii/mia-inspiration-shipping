// מסך פרטי משלוח בודד
//
// מציג את כל הפרטים, ומאפשר פעולות לפי סטטוס + תפקיד המשתמש:
// - admin/warehouse בסטטוס pending: סימון "נשלח" / ביטול
// - admin/branch (היעד) בסטטוס sent: טופס אישור קבלה
// - admin: שינוי לכל סטטוס

import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  getShipment,
  updateShipmentStatus,
  confirmShipmentReceipt,
  PACKAGE_TYPES,
} from '../api/shipments.js';
import StatusBadge from '../components/StatusBadge.jsx';

const PACKAGE_TYPE_MAP = Object.fromEntries(PACKAGE_TYPES.map((p) => [p.value, p.label]));

const ROLE_LABELS = {
  admin: 'מנהל מערכת',
  accounting: 'הנהלת חשבונות',
  warehouse: 'מחסן',
  branch: 'סניף',
};

function formatDateTime(isoString) {
  if (!isoString) return '—';
  const date = new Date(isoString.replace(' ', 'T') + 'Z');
  return date.toLocaleString('he-IL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ShipmentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [shipment, setShipment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadShipment() {
    setLoading(true);
    setError('');
    try {
      const data = await getShipment(id);
      setShipment(data);
    } catch (err) {
      setError(err.response?.data?.error || 'לא ניתן לטעון את המשלוח');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadShipment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="card text-center text-gray-500">טוען...</div>
      </div>
    );
  }

  if (error || !shipment) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        <div className="card border-red-200 bg-red-50 text-red-700">
          {error || 'המשלוח לא נמצא'}
        </div>
        <Link to="/shipments" className="btn-secondary inline-block">חזרה לרשימה</Link>
      </div>
    );
  }

  // === בדיקת הרשאות לפעולות ===
  const isAdmin = user.role === 'admin';
  const isWarehouse = user.role === 'warehouse';
  const isTargetBranch = user.role === 'branch' && user.branch_id === shipment.target_branch_id;

  const canMarkAsSent = (isAdmin || isWarehouse) && shipment.status === 'pending';
  const canConfirmReceipt = (isAdmin || isTargetBranch) && shipment.status === 'sent';
  const canCancel = isAdmin && ['pending', 'sent'].includes(shipment.status);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* כותרת + Back */}
      <div className="space-y-3">
        <Link to="/shipments" className="text-sm text-blue-600 hover:underline">
          ← חזרה לרשימה
        </Link>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 font-mono">
              {shipment.reference_id}
            </h1>
            <p className="text-gray-600 mt-1">פרטי משלוח</p>
          </div>
          <StatusBadge status={shipment.status} />
        </div>
      </div>

      {/* כרטיסיית הפרטים */}
      <div className="card space-y-5">
        <DetailRow label="מאת" value={shipment.source_branch_name} />
        <DetailRow label="אל" value={shipment.target_branch_name} highlight />

        <div className="grid grid-cols-2 gap-4">
          <DetailRow
            label="כמות מארזים שנשלחו"
            value={<strong className="text-lg">{shipment.package_count}</strong>}
          />
          <DetailRow
            label="סוג מארז"
            value={PACKAGE_TYPE_MAP[shipment.package_type] || shipment.package_type}
          />
        </div>

        {shipment.received_count != null && (
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
            <DetailRow
              label="כמות שהתקבלה בפועל"
              value={
                <strong className={`text-lg ${
                  shipment.received_count === shipment.package_count
                    ? 'text-emerald-700'
                    : 'text-amber-700'
                }`}>
                  {shipment.received_count}
                </strong>
              }
            />
            <DetailRow
              label="הפרש"
              value={
                shipment.received_count === shipment.package_count
                  ? '✓ תואם'
                  : `${shipment.received_count - shipment.package_count >= 0 ? '+' : ''}${shipment.received_count - shipment.package_count}`
              }
            />
          </div>
        )}

        {shipment.notes && (
          <DetailRow label="הערות" value={shipment.notes} />
        )}
      </div>

      {/* היסטוריית פעולות */}
      <div className="card space-y-3">
        <h2 className="font-bold text-gray-900">היסטוריה</h2>
        <div className="text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-600">נוצר על ידי:</span>
            <span>{shipment.created_by_full_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">תאריך יצירה:</span>
            <span>{formatDateTime(shipment.created_at)}</span>
          </div>
          {shipment.received_at && (
            <>
              <div className="flex justify-between">
                <span className="text-gray-600">אושר על ידי:</span>
                <span>{shipment.received_by_full_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">תאריך אישור:</span>
                <span>{formatDateTime(shipment.received_at)}</span>
              </div>
            </>
          )}
          {shipment.updated_at && shipment.updated_at !== shipment.created_at && (
            <div className="flex justify-between">
              <span className="text-gray-600">עודכן לאחרונה:</span>
              <span>{formatDateTime(shipment.updated_at)}</span>
            </div>
          )}
        </div>
      </div>

      {/* פעולות אפשריות */}
      {canMarkAsSent && (
        <ActionSection
          title="פעולה — סימון כנשלח"
          description="לחיצה תסמן את המשלוח כיצא לדרך. הסניף המקבל יראה אותו ברשימה ויוכל לאשר קבלה."
        >
          <ActionButton
            label="סמן כנשלח"
            onAction={async () => {
              await updateShipmentStatus(shipment.id, 'sent', null);
              loadShipment();
            }}
            variant="primary"
          />
        </ActionSection>
      )}

      {canConfirmReceipt && (
        <ConfirmReceiptForm
          shipment={shipment}
          onSuccess={loadShipment}
        />
      )}

      {canCancel && (
        <ActionSection title="ביטול משלוח">
          <ActionButton
            label="בטל משלוח"
            confirmMessage="לבטל את המשלוח? פעולה זו לא ניתנת להפיכה."
            onAction={async () => {
              await updateShipmentStatus(shipment.id, 'cancelled', null, 'בוטל ידנית על ידי מנהל');
              loadShipment();
            }}
            variant="danger"
          />
        </ActionSection>
      )}
    </div>
  );
}

// ============== רכיבי עזר ==============

function DetailRow({ label, value, highlight = false }) {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      <div className={highlight ? 'font-bold text-gray-900' : 'text-gray-800'}>{value}</div>
    </div>
  );
}

function ActionSection({ title, description, children }) {
  return (
    <div className="card space-y-3">
      <h2 className="font-bold text-gray-900">{title}</h2>
      {description && <p className="text-sm text-gray-600">{description}</p>}
      <div className="flex flex-wrap gap-3 pt-1">{children}</div>
    </div>
  );
}

function ActionButton({ label, onAction, variant = 'primary', confirmMessage }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleClick() {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setBusy(true);
    setError('');
    try {
      await onAction();
    } catch (err) {
      setError(err.response?.data?.error || 'הפעולה נכשלה');
    } finally {
      setBusy(false);
    }
  }

  const className =
    variant === 'danger'
      ? 'min-h-11 px-6 py-2.5 rounded-lg font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50'
      : 'btn-primary disabled:opacity-50';

  return (
    <div>
      <button onClick={handleClick} disabled={busy} className={className}>
        {busy ? 'מבצעת...' : label}
      </button>
      {error && <div className="text-sm text-red-600 mt-2">{error}</div>}
    </div>
  );
}

function ConfirmReceiptForm({ shipment, onSuccess }) {
  const [receivedCount, setReceivedCount] = useState(String(shipment.package_count));
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await confirmShipmentReceipt(shipment.id, parseInt(receivedCount, 10), notes.trim() || null);
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'הפעולה נכשלה');
    } finally {
      setBusy(false);
    }
  }

  const numericReceived = parseInt(receivedCount, 10);
  const willMismatch = !Number.isNaN(numericReceived) && numericReceived !== shipment.package_count;

  return (
    <form onSubmit={handleSubmit} className="card space-y-4 border-blue-200">
      <div>
        <h2 className="font-bold text-gray-900">אישור קבלת משלוח</h2>
        <p className="text-sm text-gray-600 mt-1">
          הכניסי את הכמות שהתקבלה בפועל. אם תהיה אי-התאמה, היא תתועד אוטומטית בדוח.
        </p>
      </div>

      <div>
        <label htmlFor="received" className="block text-sm font-medium text-gray-700 mb-1">
          כמות מארזים שהתקבלה <span className="text-red-500">*</span>
        </label>
        <input
          id="received"
          type="number"
          min="0"
          max="999"
          value={receivedCount}
          onChange={(e) => setReceivedCount(e.target.value)}
          required
          disabled={busy}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     disabled:bg-gray-100"
        />
        <p className="text-xs text-gray-500 mt-1">
          נשלחו: <strong>{shipment.package_count}</strong> מארזים
        </p>
      </div>

      {willMismatch && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded-lg text-sm">
          ⚠ אי-התאמה: נשלחו {shipment.package_count}, מתועדים {numericReceived}.
          המשלוח יסומן כ"אי-התאמה" וייכלל בדוח החודשי.
        </div>
      )}

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
          הערות (אופציונלי)
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={busy}
          rows={2}
          maxLength={200}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     disabled:bg-gray-100 resize-none"
          placeholder="פרטים על המשלוח (במיוחד אם יש אי-התאמה)..."
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-50">
        {busy ? 'מאשרת...' : 'אישור קבלה'}
      </button>
    </form>
  );
}
