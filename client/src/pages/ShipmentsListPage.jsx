// מסך רשימת משלוחים
//
// משתמש סניף רואה רק משלוחים של הסניף שלו (השרת מסנן).
// משתמש admin/warehouse/accounting רואה את כל המשלוחים.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { listShipments, STATUS_LABELS, PACKAGE_TYPES } from '../api/shipments.js';
import StatusBadge from '../components/StatusBadge.jsx';

// אפשרויות סינון - 'all' מציג הכל
const FILTERS = [
  { value: 'all',       label: 'הכל' },
  { value: 'pending',   label: 'ממתין' },
  { value: 'sent',      label: 'נשלח' },
  { value: 'received',  label: 'התקבל' },
  { value: 'mismatch',  label: 'אי-התאמה' },
];

// מיפוי קוד סוג מארז → שם בעברית
const PACKAGE_TYPE_MAP = Object.fromEntries(PACKAGE_TYPES.map((p) => [p.value, p.label]));

/**
 * פורמט תאריך עברי קצר: "5 במאי, 14:32"
 */
function formatHebrewDate(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString.replace(' ', 'T') + 'Z');
  const dateStr = date.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' });
  const timeStr = date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  return `${dateStr}, ${timeStr}`;
}

export default function ShipmentsListPage() {
  const { user } = useAuth();
  const [shipments, setShipments] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadShipments() {
    setLoading(true);
    setError('');
    try {
      const filters = filter === 'all' ? {} : { status: filter };
      const list = await listShipments(filters);
      setShipments(list);
    } catch (err) {
      setError(err.response?.data?.error || 'שגיאה בטעינת המשלוחים');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadShipments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const isBranchUser = user.role === 'branch';

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">רשימת משלוחים</h1>
          <p className="text-gray-600 mt-1">
            {isBranchUser
              ? `משלוחים נכנסים ויוצאים של ${user.branch_name}`
              : 'כל המשלוחים במערכת'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadShipments} className="btn-secondary" disabled={loading}>
            {loading ? '🔄' : '↻'} רענון
          </button>
          <Link to="/shipments/new" className="btn-primary">
            + משלוח חדש
          </Link>
        </div>
      </header>

      {/* סינון לפי סטטוס */}
      <div className="card !p-2">
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                filter === f.value
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* תוכן */}
      {error && (
        <div className="card border-red-200 bg-red-50 text-red-700">
          {error}
        </div>
      )}

      {loading && (
        <div className="card text-center text-gray-500">טוען...</div>
      )}

      {!loading && !error && shipments.length === 0 && (
        <div className="card text-center text-gray-500">
          <p className="text-lg mb-2">אין משלוחים להצגה</p>
          <p className="text-sm">
            {filter !== 'all' && 'נסי לשנות את הסינון או '}
            <Link to="/shipments/new" className="text-blue-600 hover:underline">
              ליצור משלוח חדש
            </Link>
          </p>
        </div>
      )}

      {/* כרטיסי משלוחים */}
      <div className="grid grid-cols-1 gap-3">
        {shipments.map((s) => (
          <ShipmentCard key={s.id} shipment={s} userBranchId={user.branch_id} userRole={user.role} />
        ))}
      </div>
    </div>
  );
}

/**
 * כרטיס בודד של משלוח ברשימה
 */
function ShipmentCard({ shipment, userBranchId, userRole }) {
  // האם המשלוח מגיע אליי? (להתראה ויזואלית)
  const isIncoming =
    userRole === 'branch' && shipment.target_branch_code &&
    // מציאת ה-id של הסניף לא ישיר - בוחנים לפי השוואה אחרת
    false; // (פיצ'ר עתידי - כרגע לא מסמנים)

  return (
    <div className="card hover:shadow-md transition-shadow">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2 flex-1 min-w-0">
          {/* שורה ראשונה: מספר משלוח + סטטוס */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-sm font-bold text-gray-900">
              {shipment.reference_id}
            </span>
            <StatusBadge status={shipment.status} />
          </div>

          {/* שורה שנייה: מאיפה ← לאן */}
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <span className="text-gray-600">{shipment.source_branch_name}</span>
            <span className="text-gray-400">←</span>
            <span className="font-medium text-gray-900">{shipment.target_branch_name}</span>
          </div>

          {/* שורה שלישית: כמות + סוג + הערות */}
          <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
            <span>
              <strong className="text-gray-700">{shipment.package_count}</strong>{' '}
              {PACKAGE_TYPE_MAP[shipment.package_type] || shipment.package_type}
            </span>
            {shipment.received_count != null && (
              <span className="text-gray-400">
                · התקבלו: <strong className={
                  shipment.received_count === shipment.package_count
                    ? 'text-emerald-700'
                    : 'text-amber-700'
                }>{shipment.received_count}</strong>
              </span>
            )}
            {shipment.notes && (
              <span className="text-gray-400 truncate max-w-xs">· {shipment.notes}</span>
            )}
          </div>
        </div>

        {/* תאריך + יוצר */}
        <div className="text-xs text-gray-500 text-left whitespace-nowrap">
          <div>{formatHebrewDate(shipment.created_at)}</div>
          <div className="mt-0.5">{shipment.created_by_full_name}</div>
        </div>
      </div>
    </div>
  );
}
