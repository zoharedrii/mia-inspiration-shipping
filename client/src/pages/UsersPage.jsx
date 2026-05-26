// מסך ניהול משתמשים (admin בלבד)
//
// תצוגה: טופס יצירה למעלה + רשימת משתמשים מתחת.
// פעולות בכל שורה: עריכה, איפוס סיסמה, הפעלה/השבתה.

import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import {
  listUsers,
  createUser,
  updateUser,
  setUserActive,
  resetUserPassword,
  ROLE_OPTIONS,
  ROLE_LABELS,
} from '../api/users.js';
import { listBranches } from '../api/branches.js';

export default function UsersPage() {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [usersList, branchesList] = await Promise.all([listUsers(), listBranches()]);
      setUsers(usersList);
      setBranches(branchesList);
    } catch (err) {
      setError(err.response?.data?.error || 'שגיאה בטעינת הנתונים');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">ניהול משתמשים</h1>
        <p className="text-gray-600 mt-1">הוספה, עריכה והשבתה של משתמשי המערכת</p>
      </header>

      {error && (
        <div className="card border-red-200 bg-red-50 text-red-700">{error}</div>
      )}

      {/* טופס יצירת משתמש חדש */}
      <CreateUserForm branches={branches} onCreated={loadData} />

      {/* רשימת המשתמשים */}
      {loading ? (
        <div className="card text-center text-gray-500">טוען...</div>
      ) : (
        <div className="card overflow-x-auto">
          <h2 className="text-lg font-bold mb-3">משתמשים במערכת ({users.length})</h2>
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 border-b">
              <tr>
                <th className="text-right py-2 px-2">שם משתמש</th>
                <th className="text-right py-2 px-2">שם מלא</th>
                <th className="text-right py-2 px-2">תפקיד</th>
                <th className="text-right py-2 px-2">סניף</th>
                <th className="text-right py-2 px-2">פעיל</th>
                <th className="text-right py-2 px-2">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) =>
                editingId === u.id ? (
                  <EditUserRow
                    key={u.id}
                    user={u}
                    branches={branches}
                    onCancel={() => setEditingId(null)}
                    onSaved={() => {
                      setEditingId(null);
                      loadData();
                    }}
                  />
                ) : (
                  <UserRow
                    key={u.id}
                    user={u}
                    currentUserId={currentUser.id}
                    onEdit={() => setEditingId(u.id)}
                    onChanged={loadData}
                  />
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// =========================================================
// טופס יצירה
// =========================================================
function CreateUserForm({ branches, onCreated }) {
  const [show, setShow] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('branch');
  const [branchId, setBranchId] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const needsBranch = role === 'branch' || role === 'warehouse';

  function resetForm() {
    setUsername('');
    setPassword('');
    setFullName('');
    setRole('branch');
    setBranchId('');
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        username: username.trim(),
        password,
        full_name: fullName.trim(),
        role,
      };
      if (needsBranch && branchId) {
        payload.branch_id = parseInt(branchId, 10);
      }
      await createUser(payload);
      resetForm();
      setShow(false);
      onCreated();
    } catch (err) {
      setError(err.response?.data?.error || 'שגיאה ביצירת המשתמש');
    } finally {
      setSubmitting(false);
    }
  }

  if (!show) {
    return (
      <button onClick={() => setShow(true)} className="btn-primary">
        ➕ הוספת משתמש חדש
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4 border-blue-200">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">הוספת משתמש חדש</h2>
        <button
          type="button"
          onClick={() => { setShow(false); resetForm(); }}
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ✕ סגירה
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            שם משתמש <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            disabled={submitting}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="לדוגמה: 24 או user1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            שם מלא <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            disabled={submitting}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="לדוגמה: רחל לוי"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            תפקיד <span className="text-red-500">*</span>
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={submitting}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            סניף {needsBranch && <span className="text-red-500">*</span>}
          </label>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            required={needsBranch}
            disabled={submitting || !needsBranch}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
          >
            <option value="">-- בחרי סניף --</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            סיסמה ראשונית <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={4}
            disabled={submitting}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="לפחות 4 תווים"
          />
          <p className="text-xs text-gray-500 mt-1">המשתמש יוכל לשנות בעצמו בהמשך</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      <button type="submit" disabled={submitting} className="btn-primary w-full disabled:opacity-50">
        {submitting ? 'יוצרת...' : 'צור משתמש'}
      </button>
    </form>
  );
}

// =========================================================
// שורה רגילה ברשימה
// =========================================================
function UserRow({ user, currentUserId, onEdit, onChanged }) {
  const isSelf = user.id === currentUserId;

  async function handleToggleActive() {
    const action = user.is_active ? 'להשבית' : 'להפעיל';
    if (!window.confirm(`${action} את המשתמש "${user.username}"?`)) return;
    try {
      await setUserActive(user.id, !user.is_active);
      onChanged();
    } catch (err) {
      alert(err.response?.data?.error || 'הפעולה נכשלה');
    }
  }

  async function handleResetPassword() {
    const newPassword = window.prompt(`סיסמה חדשה עבור "${user.username}":`);
    if (!newPassword) return;
    try {
      await resetUserPassword(user.id, newPassword);
      alert(`הסיסמה אופסה בהצלחה ל-"${user.username}"`);
    } catch (err) {
      alert(err.response?.data?.error || 'הפעולה נכשלה');
    }
  }

  return (
    <tr className={`border-b border-gray-50 ${!user.is_active ? 'opacity-50' : ''}`}>
      <td className="py-2 px-2 font-mono text-xs">{user.username}</td>
      <td className="py-2 px-2">{user.full_name}</td>
      <td className="py-2 px-2">
        <span className="px-2 py-0.5 rounded text-xs bg-gray-100">
          {ROLE_LABELS[user.role] || user.role}
        </span>
      </td>
      <td className="py-2 px-2 text-xs text-gray-600">{user.branch_name || '—'}</td>
      <td className="py-2 px-2">
        {user.is_active ? (
          <span className="text-emerald-700 text-xs">✓ פעיל</span>
        ) : (
          <span className="text-gray-400 text-xs">○ מושבת</span>
        )}
      </td>
      <td className="py-2 px-2">
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={onEdit}
            className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
          >
            ערוך
          </button>
          <button
            onClick={handleResetPassword}
            className="text-xs px-2 py-1 rounded bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
          >
            איפוס סיסמה
          </button>
          {!isSelf && (
            <button
              onClick={handleToggleActive}
              className={`text-xs px-2 py-1 rounded border ${
                user.is_active
                  ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              {user.is_active ? 'השבת' : 'הפעל'}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// =========================================================
// שורה במצב עריכה (inline)
// =========================================================
function EditUserRow({ user, branches, onCancel, onSaved }) {
  const [fullName, setFullName] = useState(user.full_name);
  const [role, setRole] = useState(user.role);
  const [branchId, setBranchId] = useState(user.branch_id ? String(user.branch_id) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const needsBranch = role === 'branch' || role === 'warehouse';

  async function handleSave() {
    setError('');
    setSaving(true);
    try {
      const payload = { full_name: fullName.trim(), role };
      if (needsBranch && branchId) {
        payload.branch_id = parseInt(branchId, 10);
      }
      await updateUser(user.id, payload);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'שגיאה');
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="border-b border-blue-200 bg-blue-50/30">
      <td className="py-2 px-2 font-mono text-xs">{user.username}</td>
      <td className="py-2 px-2">
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
        />
      </td>
      <td className="py-2 px-2">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="px-2 py-1 border border-gray-300 rounded text-sm"
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </td>
      <td className="py-2 px-2">
        <select
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          disabled={!needsBranch}
          className="px-2 py-1 border border-gray-300 rounded text-sm disabled:bg-gray-50"
        >
          <option value="">--</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </td>
      <td colSpan="2" className="py-2 px-2">
        <div className="flex gap-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-xs px-3 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? '...' : 'שמירה'}
          </button>
          <button
            onClick={onCancel}
            className="text-xs px-3 py-1 rounded bg-gray-100 hover:bg-gray-200"
          >
            ביטול
          </button>
          {error && <span className="text-xs text-red-700 mr-2">{error}</span>}
        </div>
      </td>
    </tr>
  );
}
