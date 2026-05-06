// מסך יצירת משלוח חדש
//
// טופס שאליו יכנסו: עובד סניף, עובד מחסן, או מנהל מערכת.
// משתמש סניף - הסניף השולח קבוע (הסניף שלו).
// מנהל - יכול לבחור גם את הסניף השולח.

import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { listBranches } from '../api/branches.js';
import { createShipment, PACKAGE_TYPES } from '../api/shipments.js';

export default function CreateShipmentPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [branches, setBranches] = useState([]);
  const [loadingBranches, setLoadingBranches] = useState(true);

  // שדות הטופס
  const [sourceBranchId, setSourceBranchId] = useState('');
  const [targetBranchId, setTargetBranchId] = useState('');
  const [packageCount, setPackageCount] = useState('');
  const [packageType, setPackageType] = useState('02');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null); // המשלוח שנוצר

  // האם המשתמש יכול לבחור את הסניף השולח (רק admin) או שהוא קבוע (branch/warehouse)
  const canChooseSource = user.role === 'admin';

  useEffect(() => {
    listBranches()
      .then((list) => {
        setBranches(list);
        // הגדרת ברירת מחדל לסניף שולח אם אינו admin
        if (!canChooseSource && user.branch_id) {
          setSourceBranchId(String(user.branch_id));
        }
      })
      .catch(() => setError('לא הצלחנו לטעון את רשימת הסניפים'))
      .finally(() => setLoadingBranches(false));
  }, [canChooseSource, user.branch_id]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess(null);
    setSubmitting(true);

    try {
      const payload = {
        target_branch_id: parseInt(targetBranchId, 10),
        package_count: parseInt(packageCount, 10),
        package_type: packageType,
        notes: notes.trim() || null,
      };
      // השרת מאלץ branch/warehouse ל-source_branch של עצמם, אבל אנחנו שולחים לכל מקרה
      if (canChooseSource && sourceBranchId) {
        payload.source_branch_id = parseInt(sourceBranchId, 10);
      }

      const newShipment = await createShipment(payload);
      setSuccess(newShipment);
    } catch (err) {
      const message = err.response?.data?.error || 'שגיאה ביצירת המשלוח';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setTargetBranchId('');
    setPackageCount('');
    setPackageType('02');
    setNotes('');
    setSuccess(null);
    setError('');
  }

  if (loadingBranches) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="card text-center text-gray-500">טוען סניפים...</div>
      </div>
    );
  }

  // === מסך הצלחה אחרי יצירת משלוח ===
  if (success) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="card border-status-received/30 bg-emerald-50">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-status-received text-white flex items-center justify-center text-xl">
              ✓
            </div>
            <div>
              <h2 className="text-xl font-bold text-emerald-700">המשלוח נוצר בהצלחה</h2>
              <p className="text-sm text-emerald-600">מספר משלוח: {success.reference_id}</p>
            </div>
          </div>

          <div className="bg-white/60 rounded-lg p-4 space-y-2 text-sm mt-4">
            <div className="flex justify-between">
              <span className="text-gray-600">מאת:</span>
              <span className="font-medium">{success.source_branch_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">אל:</span>
              <span className="font-medium">{success.target_branch_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">מארזים:</span>
              <span className="font-medium">{success.package_count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">סטטוס:</span>
              <span className="font-medium">ממתין לשליחה</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button onClick={resetForm} className="btn-primary flex-1 min-w-32">
            ליצור משלוח נוסף
          </button>
          <button
            onClick={() => navigate('/')}
            className="btn-secondary flex-1 min-w-32"
          >
            חזרה לדף הבית
          </button>
        </div>
      </div>
    );
  }

  // === הטופס ===
  // לטופס המקבלים: סניפים שאינם הסניף השולח של עצמו
  const sourceBranchIdNumeric = canChooseSource
    ? sourceBranchId ? parseInt(sourceBranchId, 10) : null
    : user.branch_id;

  const targetBranchOptions = branches.filter((b) => b.id !== sourceBranchIdNumeric);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">יצירת משלוח חדש</h1>
        <p className="text-gray-600 mt-1">מילוי הטופס יוצר רשומת משלוח במערכת</p>
      </header>

      <form onSubmit={handleSubmit} className="card space-y-5">
        {/* סניף שולח */}
        {canChooseSource ? (
          <div>
            <label htmlFor="source" className="block text-sm font-medium text-gray-700 mb-1">
              סניף שולח <span className="text-red-500">*</span>
            </label>
            <select
              id="source"
              value={sourceBranchId}
              onChange={(e) => setSourceBranchId(e.target.value)}
              required
              disabled={submitting}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         disabled:bg-gray-100"
            >
              <option value="">-- בחרי סניף שולח --</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.city})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">סניף שולח</label>
            <div className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-700">
              {user.branch_name || '(לא משויך לסניף)'}
            </div>
          </div>
        )}

        {/* סניף יעד */}
        <div>
          <label htmlFor="target" className="block text-sm font-medium text-gray-700 mb-1">
            סניף יעד <span className="text-red-500">*</span>
          </label>
          <select
            id="target"
            value={targetBranchId}
            onChange={(e) => setTargetBranchId(e.target.value)}
            required
            disabled={submitting}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       disabled:bg-gray-100"
          >
            <option value="">-- בחרי סניף יעד --</option>
            {targetBranchOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.city})
              </option>
            ))}
          </select>
        </div>

        {/* כמות מארזים + סוג */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="count" className="block text-sm font-medium text-gray-700 mb-1">
              כמות מארזים <span className="text-red-500">*</span>
            </label>
            <input
              id="count"
              type="number"
              min="1"
              max="999"
              value={packageCount}
              onChange={(e) => setPackageCount(e.target.value)}
              required
              disabled={submitting}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         disabled:bg-gray-100"
              placeholder="לדוגמה: 5"
            />
          </div>

          <div>
            <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
              סוג מארז <span className="text-red-500">*</span>
            </label>
            <select
              id="type"
              value={packageType}
              onChange={(e) => setPackageType(e.target.value)}
              required
              disabled={submitting}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         disabled:bg-gray-100"
            >
              {PACKAGE_TYPES.map((pt) => (
                <option key={pt.value} value={pt.value}>
                  {pt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* הערות */}
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
            הערות (אופציונלי)
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={submitting}
            rows={3}
            maxLength={200}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       disabled:bg-gray-100 resize-none"
            placeholder="פרטים נוספים על המשלוח..."
          />
          <p className="text-xs text-gray-500 mt-1">{notes.length}/200 תווים</p>
        </div>

        {/* הודעת שגיאה */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* כפתורי פעולה */}
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary flex-1 min-w-32 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'יוצרת...' : 'צור משלוח'}
          </button>
          <Link to="/" className="btn-secondary flex-1 min-w-32 text-center">
            ביטול
          </Link>
        </div>
      </form>
    </div>
  );
}
