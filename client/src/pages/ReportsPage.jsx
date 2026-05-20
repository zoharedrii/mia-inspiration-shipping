// מסך דוחות וניתוחים
//
// מסך אחד עם 4 לשוניות:
// 1. דוח משלוחים חודשי
// 2. אי-התאמות
// 3. משלוחים פעילים
// 4. פעילות סניף

import { useEffect, useState } from 'react';
import {
  getMonthlyReport,
  getMismatchesReport,
  getActiveShipmentsReport,
  getBranchActivityReport,
} from '../api/reports.js';
import { listBranches } from '../api/branches.js';
import { STATUS_LABELS, STATUS_CLASSES } from '../api/shipments.js';
import StatusBadge from '../components/StatusBadge.jsx';

const TABS = [
  { id: 'monthly',  label: 'חודשי' },
  { id: 'mismatch', label: 'אי-התאמות' },
  { id: 'active',   label: 'משלוחים פעילים' },
  { id: 'branch',   label: 'פעילות סניף' },
];

function formatDate(isoString) {
  if (!isoString) return '—';
  const date = new Date(isoString.replace(' ', 'T') + 'Z');
  return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('monthly');

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">דוחות וניתוחים</h1>
        <p className="text-gray-600 mt-1">ניתוח פעילות המשלוחים ברשת</p>
      </header>

      {/* לשוניות */}
      <div className="card !p-2">
        <div className="flex flex-wrap gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === t.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* תוכן */}
      {activeTab === 'monthly'  && <MonthlyTab  />}
      {activeTab === 'mismatch' && <MismatchTab />}
      {activeTab === 'active'   && <ActiveTab   />}
      {activeTab === 'branch'   && <BranchTab   />}
    </div>
  );
}

// ============================================================================
// טאב 1 — דוח חודשי
// ============================================================================
function MonthlyTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      setData(await getMonthlyReport(year, month));
    } catch (err) {
      setError(err.response?.data?.error || 'שגיאה בטעינת הדוח');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-line */ }, [year, month]);

  return (
    <div className="space-y-4">
      {/* בחירת חודש */}
      <div className="card flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-gray-700">חודש:</label>
        <select value={month} onChange={(e) => setMonth(parseInt(e.target.value, 10))}
                className="px-3 py-1.5 border border-gray-300 rounded-md">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <label className="text-sm font-medium text-gray-700">שנה:</label>
        <input type="number" min="2020" max="2050" value={year}
               onChange={(e) => setYear(parseInt(e.target.value, 10))}
               className="px-3 py-1.5 border border-gray-300 rounded-md w-24" />
      </div>

      {error && <div className="card border-red-200 bg-red-50 text-red-700">{error}</div>}
      {loading && <div className="card text-center text-gray-500">טוען...</div>}

      {data && !loading && (
        <>
          <SummaryGrid items={[
            { label: 'סך משלוחים',      value: data.summary.total },
            { label: 'ממתינים',          value: data.summary.pending,    color: 'gray' },
            { label: 'נשלחו',           value: data.summary.sent,        color: 'blue' },
            { label: 'התקבלו',          value: data.summary.received,    color: 'emerald' },
            { label: 'אי-התאמות',       value: data.summary.mismatch,    color: 'amber' },
            { label: 'בוטלו',            value: data.summary.cancelled,   color: 'gray' },
            { label: 'מארזים שנשלחו',   value: data.summary.total_packages },
            { label: 'מארזים שהתקבלו', value: data.summary.received_packages },
          ]} />

          <ShipmentsTable shipments={data.shipments} />
        </>
      )}
    </div>
  );
}

// ============================================================================
// טאב 2 — אי-התאמות
// ============================================================================
function MismatchTab() {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const firstOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10);

  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(firstOfNextMonth);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      setData(await getMismatchesReport(from, to));
    } catch (err) {
      setError(err.response?.data?.error || 'שגיאה בטעינת הדוח');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-line */ }, [from, to]);

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-gray-700">מ-:</label>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
               className="px-3 py-1.5 border border-gray-300 rounded-md" />
        <label className="text-sm font-medium text-gray-700">עד:</label>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
               className="px-3 py-1.5 border border-gray-300 rounded-md" />
      </div>

      {error && <div className="card border-red-200 bg-red-50 text-red-700">{error}</div>}
      {loading && <div className="card text-center text-gray-500">טוען...</div>}

      {data && !loading && (
        <>
          <SummaryGrid items={[
            { label: 'סך אי-התאמות', value: data.summary.total,         color: 'amber' },
            { label: 'מארזים חסרים', value: Math.abs(data.summary.total_shortage), color: 'red' },
            { label: 'מארזים עודפים', value: data.summary.total_excess,  color: 'blue' },
          ]} />

          {data.shipments.length === 0 ? (
            <div className="card text-center text-gray-500">אין אי-התאמות בטווח שנבחר 🎉</div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500 border-b">
                  <tr>
                    <th className="text-right py-2 px-2">מספר משלוח</th>
                    <th className="text-right py-2 px-2">מאת</th>
                    <th className="text-right py-2 px-2">אל</th>
                    <th className="text-right py-2 px-2">נשלחו</th>
                    <th className="text-right py-2 px-2">התקבלו</th>
                    <th className="text-right py-2 px-2">הפרש</th>
                    <th className="text-right py-2 px-2">תאריך</th>
                  </tr>
                </thead>
                <tbody>
                  {data.shipments.map((s) => (
                    <tr key={s.id} className="border-b border-gray-50">
                      <td className="py-2 px-2 font-mono text-xs">{s.reference_id}</td>
                      <td className="py-2 px-2">{s.source_name}</td>
                      <td className="py-2 px-2">{s.target_name}</td>
                      <td className="py-2 px-2">{s.package_count}</td>
                      <td className="py-2 px-2">{s.received_count}</td>
                      <td className={`py-2 px-2 font-bold ${s.diff < 0 ? 'text-red-700' : 'text-blue-700'}`}>
                        {s.diff > 0 ? `+${s.diff}` : s.diff}
                      </td>
                      <td className="py-2 px-2 text-xs text-gray-500">{formatDate(s.received_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================================
// טאב 3 — משלוחים פעילים
// ============================================================================
function ActiveTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getActiveShipmentsReport()
      .then(setData)
      .catch((err) => setError(err.response?.data?.error || 'שגיאה'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      {error && <div className="card border-red-200 bg-red-50 text-red-700">{error}</div>}
      {loading && <div className="card text-center text-gray-500">טוען...</div>}

      {data && !loading && (
        <>
          <SummaryGrid items={[
            { label: 'סך פעילים',      value: data.summary.total },
            { label: 'ממתינים',         value: data.summary.pending_count, color: 'gray' },
            { label: 'נשלחו',          value: data.summary.sent_count,     color: 'blue' },
            { label: '3+ ימים ללא סיום', value: data.summary.overdue_count,  color: 'red' },
          ]} />

          {data.shipments.length === 0 ? (
            <div className="card text-center text-gray-500">אין משלוחים פעילים כרגע 🎉</div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500 border-b">
                  <tr>
                    <th className="text-right py-2 px-2">מספר משלוח</th>
                    <th className="text-right py-2 px-2">מאת</th>
                    <th className="text-right py-2 px-2">אל</th>
                    <th className="text-right py-2 px-2">סטטוס</th>
                    <th className="text-right py-2 px-2">מארזים</th>
                    <th className="text-right py-2 px-2">ימים פתוח</th>
                  </tr>
                </thead>
                <tbody>
                  {data.shipments.map((s) => (
                    <tr key={s.id} className="border-b border-gray-50">
                      <td className="py-2 px-2 font-mono text-xs">{s.reference_id}</td>
                      <td className="py-2 px-2">{s.source_name}</td>
                      <td className="py-2 px-2">{s.target_name}</td>
                      <td className="py-2 px-2"><StatusBadge status={s.status} /></td>
                      <td className="py-2 px-2">{s.package_count}</td>
                      <td className={`py-2 px-2 font-bold ${
                        s.days_since_creation >= 3 ? 'text-red-700' : 'text-gray-700'
                      }`}>
                        {s.days_since_creation}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================================
// טאב 4 — פעילות סניף
// ============================================================================
function BranchTab() {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const firstOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10);

  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(firstOfNextMonth);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    listBranches().then((list) => {
      setBranches(list);
      if (list.length && !branchId) setBranchId(String(list[0].id));
    });
    // eslint-disable-next-line
  }, []);

  async function load() {
    if (!branchId) return;
    setLoading(true);
    setError('');
    try {
      setData(await getBranchActivityReport(parseInt(branchId, 10), from, to));
    } catch (err) {
      setError(err.response?.data?.error || 'שגיאה בטעינת הדוח');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-line */ }, [branchId, from, to]);

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-gray-700">סניף:</label>
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-md flex-1 min-w-48">
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <label className="text-sm font-medium text-gray-700">מ-:</label>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
               className="px-3 py-1.5 border border-gray-300 rounded-md" />
        <label className="text-sm font-medium text-gray-700">עד:</label>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
               className="px-3 py-1.5 border border-gray-300 rounded-md" />
      </div>

      {error && <div className="card border-red-200 bg-red-50 text-red-700">{error}</div>}
      {loading && <div className="card text-center text-gray-500">טוען...</div>}

      {data && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card">
            <h3 className="font-bold text-gray-900 mb-3">📤 משלוחים יוצאים</h3>
            <SummaryGrid items={[
              { label: 'סך משלוחים', value: data.outgoing.total },
              { label: 'סך מארזים',  value: data.outgoing.total_packages },
            ]} />
            <p className="text-xs text-gray-500 mt-2">משלוחים שהסניף שלח אל סניפים אחרים</p>
          </div>

          <div className="card">
            <h3 className="font-bold text-gray-900 mb-3">📥 משלוחים נכנסים</h3>
            <SummaryGrid items={[
              { label: 'סך משלוחים',  value: data.incoming.total },
              { label: 'סך מארזים',   value: data.incoming.total_packages },
              { label: 'אי-התאמות',   value: data.incoming.mismatches, color: 'amber' },
            ]} />
            <p className="text-xs text-gray-500 mt-2">משלוחים שהגיעו אל הסניף</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// רכיבי עזר
// ============================================================================

function SummaryGrid({ items }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {items.map((item) => (
        <div key={item.label} className="card !p-3">
          <div className="text-xs text-gray-500">{item.label}</div>
          <div className={`text-2xl font-bold mt-1 ${
            item.color === 'red'     ? 'text-red-700' :
            item.color === 'amber'   ? 'text-amber-700' :
            item.color === 'emerald' ? 'text-emerald-700' :
            item.color === 'blue'    ? 'text-blue-700' :
            item.color === 'gray'    ? 'text-gray-700' :
            'text-gray-900'
          }`}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function ShipmentsTable({ shipments }) {
  if (shipments.length === 0) {
    return <div className="card text-center text-gray-500">אין משלוחים בתקופה זו</div>;
  }
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-gray-500 border-b">
          <tr>
            <th className="text-right py-2 px-2">מספר משלוח</th>
            <th className="text-right py-2 px-2">מאת</th>
            <th className="text-right py-2 px-2">אל</th>
            <th className="text-right py-2 px-2">מארזים</th>
            <th className="text-right py-2 px-2">סטטוס</th>
            <th className="text-right py-2 px-2">תאריך</th>
          </tr>
        </thead>
        <tbody>
          {shipments.map((s) => (
            <tr key={s.id} className="border-b border-gray-50">
              <td className="py-2 px-2 font-mono text-xs">{s.reference_id}</td>
              <td className="py-2 px-2">{s.source_name}</td>
              <td className="py-2 px-2">{s.target_name}</td>
              <td className="py-2 px-2">{s.package_count}</td>
              <td className="py-2 px-2"><StatusBadge status={s.status} /></td>
              <td className="py-2 px-2 text-xs text-gray-500">{formatDate(s.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
