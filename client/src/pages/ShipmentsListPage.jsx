// מסך רשימת משלוחים
//
// משתמש סניף רואה רק משלוחים של הסניף שלו (השרת מסנן).
// משתמש admin/warehouse/accounting רואה את כל המשלוחים.

import { useEffect, useState } from 'react';
// useState משמש גם ברכיב ShipmentCard למטה
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { listShipments, cancelShipment, canCancelShipment, canPrintLabel, STATUS_LABELS, PACKAGE_TYPES } from '../api/shipments.js';
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
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Debounce על החיפוש - מחכים 400ms אחרי שמפסיקים להקליד
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(handle);
  }, [search]);

  async function loadShipments() {
    setLoading(true);
    setError('');
    try {
      const filters = {};
      if (filter !== 'all') filters.status = filter;
      if (debouncedSearch) filters.search = debouncedSearch;
      if (fromDate) filters.from = fromDate;
      // to הוא לא כולל - נוסיף יום אחד כדי שיכלול את היום שנבחר
      if (toDate) {
        const next = new Date(toDate);
        next.setDate(next.getDate() + 1);
        filters.to = next.toISOString().slice(0, 10);
      }
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
  }, [filter, debouncedSearch, fromDate, toDate]);

  function clearAllFilters() {
    setSearch('');
    setFromDate('');
    setToDate('');
    setFilter('all');
  }

  const hasActiveFilters = filter !== 'all' || debouncedSearch || fromDate || toDate;

  // ====== בחירת משלוחים להדפסה ======
  function toggleSelected(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === shipments.length && shipments.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(shipments.map((s) => s.id)));
    }
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  const allSelected = shipments.length > 0 && selectedIds.size === shipments.length;
  const batchUrl = '/shipments/labels?ids=' + Array.from(selectedIds).join(',');

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

      {/* חיפוש + סינון מתקדם */}
      <div className="card space-y-3">
        {/* שורה ראשונה: חיפוש לפי מספר */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            חיפוש לפי מספר משלוח
          </label>
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 pr-9 border border-gray-300 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="לדוגמה: SHP-20260520 או חלק ממנו"
            />
            <span className="absolute right-3 top-2.5 text-gray-400">🔍</span>
          </div>
        </div>

        {/* שורה שנייה: טווח תאריכים */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">מתאריך</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">עד תאריך</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* שורה שלישית: סינון לפי סטטוס + ניקוי */}
        <div className="flex flex-wrap gap-1 items-center pt-2 border-t border-gray-100">
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
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="px-3 py-2 mr-auto text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md"
            >
              ✕ נקה סינון
            </button>
          )}
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

      {/* פס פעולות מרובות - מופיע רק כשיש בחירה */}
      {shipments.length > 0 && (
        <div className="card !p-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              className="w-4 h-4 cursor-pointer"
            />
            <span>בחר הכל</span>
          </label>

          {selectedIds.size > 0 && (
            <>
              <div className="text-sm text-gray-600 mx-2">
                נבחרו: <strong>{selectedIds.size}</strong> משלוחים
              </div>
              <a
                href={batchUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-1"
              >
                🖨️ הדפסת מדבקות
              </a>
              <button
                onClick={clearSelection}
                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md"
              >
                ניקוי בחירה
              </button>
            </>
          )}
        </div>
      )}

      {/* כרטיסי משלוחים */}
      <div className="grid grid-cols-1 gap-3">
        {shipments.map((s) => (
          <ShipmentCard
            key={s.id}
            shipment={s}
            user={user}
            onChanged={loadShipments}
            selected={selectedIds.has(s.id)}
            onToggleSelect={() => toggleSelected(s.id)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * כרטיס בודד של משלוח ברשימה
 */
function ShipmentCard({ shipment, user, onChanged, selected, onToggleSelect }) {
  const [cancelling, setCancelling] = useState(false);
  const showCancelButton = canCancelShipment(shipment, user);

  async function handleCancel(event) {
    // עוצר את הקליק מלהפעיל את הלינק החיצוני
    event.preventDefault();
    event.stopPropagation();

    if (!window.confirm(`לבטל את משלוח ${shipment.reference_id}? פעולה זו לא ניתנת להפיכה.`)) {
      return;
    }

    setCancelling(true);
    try {
      await cancelShipment(shipment.id, 'בוטל מרשימת המשלוחים');
      onChanged(); // טעינה מחדש של הרשימה
    } catch (err) {
      alert(err.response?.data?.error || 'הביטול נכשל');
      setCancelling(false);
    }
  }

  function handleCheckboxClick(event) {
    // עוצר את הקליק מלהפעיל את ה-Link
    event.preventDefault();
    event.stopPropagation();
    onToggleSelect();
  }

  return (
    <Link
      to={`/shipments/${shipment.id}`}
      className={`card hover:shadow-md transition-all block relative ${
        selected ? 'border-blue-400 bg-blue-50/40' : 'hover:border-blue-200'
      }`}
    >
      {/* Checkbox לבחירה - מוסתר אם לא ניתן להדפיס (cancelled/not_received) */}
      {canPrintLabel(shipment) && (
        <div className="absolute top-3 left-3" onClick={handleCheckboxClick}>
          <input
            type="checkbox"
            checked={selected}
            onChange={() => {}}
            className="w-4 h-4 cursor-pointer"
            title="בחירה להדפסת מדבקה"
          />
        </div>
      )}
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

        {/* תאריך + יוצר + כפתור ביטול אם רלוונטי */}
        <div className="flex flex-col items-end gap-2">
          <div className="text-xs text-gray-500 text-left whitespace-nowrap">
            <div>{formatHebrewDate(shipment.created_at)}</div>
            <div className="mt-0.5">{shipment.created_by_full_name}</div>
          </div>
          {showCancelButton && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={cancelling}
              className="text-xs px-3 py-1 rounded-md bg-red-50 text-red-700 border border-red-200
                         hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="ביטול המשלוח"
            >
              {cancelling ? '...' : '✕ ביטול'}
            </button>
          )}
        </div>
      </div>
    </Link>
  );
}
