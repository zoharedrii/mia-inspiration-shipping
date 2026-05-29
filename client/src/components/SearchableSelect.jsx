// SearchableSelect - dropdown עם חיפוש
//
// משמש לבחירת סניף כשיש הרבה אופציות (18+ סניפים).
// המשתמש יכול להקליד חלק מהשם כדי לסנן.

import { useEffect, useRef, useState } from 'react';

export default function SearchableSelect({
  options = [],          // [{ value, label, secondary? }]
  value,                 // הערך שנבחר (כסטרינג)
  onChange,              // (newValue) => void
  placeholder = 'בחרי...',
  disabled = false,
  required = false,
  emptyMessage = 'אין תוצאות',
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  // הערך שנבחר כאובייקט
  const selectedOption = options.find((o) => String(o.value) === String(value));

  // אם המשתמש לא הקליד שום דבר ולא ממוקד - מציגים את הערך הנבחר
  const displayValue = open ? query : (selectedOption ? selectedOption.label : '');

  // סינון לפי query
  const filtered = options.filter((o) => {
    if (!query.trim()) return true;
    const q = query.trim();
    return (
      o.label.includes(q) ||
      (o.secondary && o.secondary.includes(q))
    );
  });

  // סגירה בלחיצה מחוץ לרכיב
  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleSelect(opt) {
    onChange(String(opt.value));
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={displayValue}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        disabled={disabled}
        required={required && !value}
        autoComplete="off"
        className="w-full px-3 py-2.5 pl-9 border border-gray-300 rounded-lg
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                   disabled:bg-gray-100"
      />

      {/* אייקון חץ/חיפוש */}
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
        {open ? '🔍' : '▾'}
      </div>

      {/* רשימת התוצאות */}
      {open && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white shadow-lg border border-gray-200">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-500">{emptyMessage}</li>
          ) : (
            filtered.map((opt) => (
              <li
                key={opt.value}
                onClick={() => handleSelect(opt)}
                className={`cursor-pointer px-3 py-2 text-sm hover:bg-blue-50 ${
                  String(opt.value) === String(value) ? 'bg-blue-100 font-medium' : ''
                }`}
              >
                {opt.label}
                {opt.secondary && (
                  <span className="text-xs text-gray-500 mr-2">· {opt.secondary}</span>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
