// מחולל קובץ seed.sql ל-D1.
//
// למה צריך מחולל ולא קובץ SQL ידני?
// כי הסיסמאות צריכות להישמר כ-hash (PBKDF2), וה-hash מיוצר בקוד.
// הסקריפט הזה משתמש בדיוק באותו hashPassword שה-Worker מאמת איתו בהתחברות,
// כך שהסיסמאות שנכניס ל-DB יתאימו ל-login.
//
// הרצה:  node seed/generate-seed.mjs   (מתוך תיקיית worker/)
// הפלט:  worker/seed/seed.sql

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { hashPassword } from '../src/lib/password.js';

const ADMIN_PASSWORD = 'password123';
const BRANCH_PASSWORD_PREFIX = 'Mia'; // סיסמת סניף = Mia + מספר הסניף

// 18 סניפי מייה אינספיריישן + מחסן מרכזי
const BRANCHES = [
  // ====== מחסן מרכזי ======
  {
    code: 'WH-CENTRAL',
    branch_number: null,
    name: 'מחסן מרכזי - מייה',
    address: 'הרימון 8',
    city: 'שוהם',
    zip: '6082935',
    contact_name: 'מנהל מחסן',
    contact_phone: '0508754123',
    is_warehouse: 1,
  },

  // ====== 18 סניפי הרשת ======
  { code: 'BR-11', branch_number: 11, name: 'מייה איילון',              city: 'רמת גן',      contact_phone: '050-1902011' },
  { code: 'BR-12', branch_number: 12, name: 'מייה רחובות',             city: 'רחובות',      contact_phone: '050-1902012' },
  { code: 'BR-13', branch_number: 13, name: 'מייה זהב ראשון לציון',    city: 'ראשון לציון', contact_phone: '050-1902013' },
  { code: 'BR-14', branch_number: 14, name: 'מייה גבעתיים',            city: 'גבעתיים',     contact_phone: '050-1902014' },
  { code: 'BR-15', branch_number: 15, name: 'מייה גרנד חיפה',          city: 'חיפה',        contact_phone: '050-1902015' },
  { code: 'BR-16', branch_number: 16, name: 'מייה קריון',              city: 'קרית ביאליק', contact_phone: '050-1902016' },
  { code: 'BR-17', branch_number: 17, name: 'מייה אבנת פתח תקווה',     city: 'פתח תקווה',   contact_phone: '050-1902017' },
  { code: 'BR-18', branch_number: 18, name: 'מייה ביג אשדוד',          city: 'אשדוד',       contact_phone: '050-1902018' },
  { code: 'BR-19', branch_number: 19, name: 'מייה עזריאלי תל אביב',    city: 'תל אביב',     contact_phone: '050-1902019' },
  { code: 'BR-20', branch_number: 20, name: 'מייה עזריאלי חולון',      city: 'חולון',       contact_phone: '050-1902020' },
  { code: 'BR-21', branch_number: 21, name: 'מייה גרנד באר שבע',       city: 'באר שבע',     contact_phone: '050-1902021' },
  { code: 'BR-22', branch_number: 22, name: 'מייה עיר ימים נתניה',     city: 'נתניה',       contact_phone: '050-1902022' },
  { code: 'BR-23', branch_number: 23, name: 'מייה ביג באר שבע',        city: 'באר שבע',     contact_phone: '050-1902023' },
  { code: 'BR-26', branch_number: 26, name: 'מייה רוטשילד ראשון לציון', city: 'ראשון לציון', contact_phone: '050-1902026' },
  { code: 'BR-27', branch_number: 27, name: 'מייה מלחה ירושלים',       city: 'ירושלים',     contact_phone: '050-1902027' },
  { code: 'BR-28', branch_number: 28, name: 'מייה ממילא ירושלים',      city: 'ירושלים',     contact_phone: '050-1902028' },
  { code: 'BR-29', branch_number: 29, name: 'מייה ביג גלילות',         city: 'רמת השרון',   contact_phone: '050-1902029' },
  { code: 'BR-30', branch_number: 30, name: 'מייה חוצות המפרץ',        city: 'חיפה',        contact_phone: '050-5172030' },
];

// משתמשים גלובליים (admin + מחסן)
const ADMIN_USERS = [
  { username: 'admin',     full_name: 'מנהל מערכת',      role: 'admin',     branch_code: null,         password: ADMIN_PASSWORD },
  { username: 'warehouse', full_name: 'מנהל מחסן מרכזי', role: 'warehouse', branch_code: 'WH-CENTRAL', password: ADMIN_PASSWORD },
];

// בונה משתמש לכל סניף: שם משתמש = מספר הסניף, סיסמה = Mia{מספר}
function buildBranchUsers() {
  return BRANCHES
    .filter((b) => !b.is_warehouse && b.branch_number)
    .map((b) => {
      const branchShortName = b.name.replace(/^מייה\s*/, ''); // "מייה איילון" → "איילון"
      return {
        username: String(b.branch_number),
        full_name: `מנהלת סניף ${branchShortName}`,
        role: 'branch',
        branch_code: b.code,
        password: `${BRANCH_PASSWORD_PREFIX}${b.branch_number}`,
      };
    });
}

// בריחה מתווי גרש בודד עבור SQL (', '' )
function sql(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function main() {
  const lines = [];
  lines.push('-- קובץ seed אוטומטי - אל תערוך ידנית!');
  lines.push('-- נוצר ע"י seed/generate-seed.mjs (מריצים: node seed/generate-seed.mjs)');
  lines.push('-- סיסמאות: admin/warehouse = "password123", סניפים = "Mia{מספר}"');
  lines.push('');

  // ====== סניפים ======
  lines.push('-- ===== סניפים =====');
  for (const b of BRANCHES) {
    lines.push(
      'INSERT INTO branches (code, branch_number, name, address, city, zip, phone, contact_name, contact_phone, is_warehouse) VALUES (' +
      [
        sql(b.code),
        sql(b.branch_number ?? null),
        sql(b.name),
        sql(b.address ?? null),
        sql(b.city),
        sql(b.zip ?? null),
        sql(b.phone ?? null),
        sql(b.contact_name ?? null),
        sql(b.contact_phone ?? null),
        sql(b.is_warehouse ?? 0),
      ].join(', ') +
      ');'
    );
  }
  lines.push('');

  // ====== משתמשים ======
  // branch_id מחושב דרך תת-שאילתה לפי code, כי איננו יודעים מראש את ה-id ש-AUTOINCREMENT ייתן.
  lines.push('-- ===== משתמשים =====');
  const allUsers = [...ADMIN_USERS, ...buildBranchUsers()];
  for (const u of allUsers) {
    const passwordHash = await hashPassword(u.password);
    const branchIdExpr = u.branch_code
      ? `(SELECT id FROM branches WHERE code = ${sql(u.branch_code)})`
      : 'NULL';
    lines.push(
      'INSERT INTO users (username, password_hash, full_name, role, branch_id) VALUES (' +
      [
        sql(u.username),
        sql(passwordHash),
        sql(u.full_name),
        sql(u.role),
        branchIdExpr,
      ].join(', ') +
      ');'
    );
  }
  lines.push('');

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const outPath = path.join(__dirname, 'seed.sql');
  await writeFile(outPath, lines.join('\n'), 'utf8');

  console.log(`✅ נוצר ${outPath}`);
  console.log(`   ${BRANCHES.length} סניפים, ${allUsers.length} משתמשים`);
}

main().catch((err) => {
  console.error('❌ שגיאה ביצירת seed:', err);
  process.exit(1);
});
