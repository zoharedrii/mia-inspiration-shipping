// יצוא CSV עם תמיכה בעברית (UTF-8 BOM)
//
// CSV נפתח אוטומטית באקסל ובגוגל שיטס.
// ה-BOM (Byte Order Mark) מבטיח שאקסל יפתח את הקובץ בקידוד UTF-8 ולא בלטיני.

/**
 * הופך מערך של שורות לכתוב CSV ומוריד אותו.
 *
 * @param {string} filename - שם הקובץ (ללא הרחבה)
 * @param {string[]} headers - כותרות העמודות
 * @param {Array<Array<string|number>>} rows - שורות הנתונים
 */
export function downloadCSV(filename, headers, rows) {
  const escape = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    // עטיפה במרכאות אם יש פסיק/מרכאה/שורה חדשה
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvRows = [
    headers.map(escape).join(','),
    ...rows.map((row) => row.map(escape).join(',')),
  ];
  const csvContent = csvRows.join('\n');

  // BOM לתמיכה בעברית באקסל
  const BOM = '﻿';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
