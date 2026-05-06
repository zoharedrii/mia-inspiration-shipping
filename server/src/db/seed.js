// נתוני התחלה (Seed Data)
//
// מאכלס את ה-DB בנתוני בדיקה כשהוא ריק:
// - מחסן מרכזי + 18 סניפים אמיתיים של רשת מייה אינספיריישן
// - 5 משתמשים: מנהל, מחסן, ו-3 סניפי דוגמה
//
// הסיסמה הראשונית של כולם: "password123" (לפיתוח בלבד!)

import bcrypt from 'bcrypt';
import db from './index.js';

const BCRYPT_ROUNDS = 10;
const DEFAULT_PASSWORD = 'password123';

// 18 סניפי מייה אינספיריישן + מחסן מרכזי.
// branch_number = המספר הרשמי של הסניף ברשת (אין 24-25).
// פורמט הטלפון: 050-19020XX (כשXX = מספר הסניף), חוץ מ-30 שיש לו מספר אחר.
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
  { code: 'BR-11', branch_number: 11, name: 'מייה איילון',                 city: 'רמת גן',       contact_phone: '050-1902011' },
  { code: 'BR-12', branch_number: 12, name: 'מייה רחובות',                 city: 'רחובות',       contact_phone: '050-1902012' },
  { code: 'BR-13', branch_number: 13, name: 'מייה זהב ראשון לציון',        city: 'ראשון לציון',  contact_phone: '050-1902013' },
  { code: 'BR-14', branch_number: 14, name: 'מייה גבעתיים',                city: 'גבעתיים',      contact_phone: '050-1902014' },
  { code: 'BR-15', branch_number: 15, name: 'מייה גרנד חיפה',              city: 'חיפה',         contact_phone: '050-1902015' },
  { code: 'BR-16', branch_number: 16, name: 'מייה קריון',                  city: 'קרית ביאליק',  contact_phone: '050-1902016' },
  { code: 'BR-17', branch_number: 17, name: 'מייה אבנת פתח תקווה',         city: 'פתח תקווה',    contact_phone: '050-1902017' },
  { code: 'BR-18', branch_number: 18, name: 'מייה ביג אשדוד',              city: 'אשדוד',        contact_phone: '050-1902018' },
  { code: 'BR-19', branch_number: 19, name: 'מייה עזריאלי תל אביב',        city: 'תל אביב',      contact_phone: '050-1902019' },
  { code: 'BR-20', branch_number: 20, name: 'מייה עזריאלי חולון',          city: 'חולון',        contact_phone: '050-1902020' },
  { code: 'BR-21', branch_number: 21, name: 'מייה גרנד באר שבע',           city: 'באר שבע',      contact_phone: '050-1902021' },
  { code: 'BR-22', branch_number: 22, name: 'מייה עיר ימים נתניה',         city: 'נתניה',        contact_phone: '050-1902022' },
  { code: 'BR-23', branch_number: 23, name: 'מייה ביג באר שבע',            city: 'באר שבע',      contact_phone: '050-1902023' },
  { code: 'BR-26', branch_number: 26, name: 'מייה רוטשילד ראשון לציון',    city: 'ראשון לציון',  contact_phone: '050-1902026' },
  { code: 'BR-27', branch_number: 27, name: 'מייה מלחה ירושלים',           city: 'ירושלים',      contact_phone: '050-1902027' },
  { code: 'BR-28', branch_number: 28, name: 'מייה ממילא ירושלים',          city: 'ירושלים',      contact_phone: '050-1902028' },
  { code: 'BR-29', branch_number: 29, name: 'מייה ביג גלילות',             city: 'רמת השרון',    contact_phone: '050-1902029' },
  { code: 'BR-30', branch_number: 30, name: 'מייה חוצות המפרץ',            city: 'חיפה',         contact_phone: '050-5172030' },
];

// משתמשי דוגמה (כל אחד עם סיסמה password123)
const USERS = [
  { username: 'admin',     full_name: 'מנהל מערכת',                role: 'admin',     branch_code: null         },
  { username: 'warehouse', full_name: 'מנהל מחסן מרכזי',           role: 'warehouse', branch_code: 'WH-CENTRAL' },
  { username: 'ayalon',    full_name: 'מנהלת סניף איילון',         role: 'branch',    branch_code: 'BR-11'      },
  { username: 'azrieli',   full_name: 'מנהלת סניף עזריאלי תל אביב', role: 'branch',    branch_code: 'BR-19'      },
  { username: 'mamilla',   full_name: 'מנהלת סניף ממילא ירושלים',  role: 'branch',    branch_code: 'BR-28'      },
];

/**
 * בודק אם ה-DB ריק. אם כן - מאכלס אותו.
 */
export async function seedIfEmpty() {
  const branchCount = db.prepare('SELECT COUNT(*) AS c FROM branches').get().c;

  if (branchCount > 0) {
    console.log(`🌱 [Seed] ה-DB כבר מאוכלס (${branchCount} סניפים) - מדלגת על seed`);
    return;
  }

  console.log('🌱 [Seed] ה-DB ריק - מאכלסת בנתוני התחלה...');

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, BCRYPT_ROUNDS);

  // הכנסת סניפים
  const insertBranch = db.prepare(`
    INSERT INTO branches (code, branch_number, name, address, city, zip, phone, contact_name, contact_phone, is_warehouse)
    VALUES (@code, @branch_number, @name, @address, @city, @zip, @phone, @contact_name, @contact_phone, @is_warehouse)
  `);

  const insertManyBranches = db.transaction((branches) => {
    for (const branch of branches) {
      insertBranch.run({
        branch_number: null,
        address: null,
        zip: null,
        phone: null,
        contact_name: null,
        contact_phone: null,
        is_warehouse: 0,
        ...branch,
      });
    }
  });

  insertManyBranches(BRANCHES);

  // הכנסת משתמשים
  const insertUser = db.prepare(`
    INSERT INTO users (username, password_hash, full_name, role, branch_id)
    VALUES (@username, @password_hash, @full_name, @role, @branch_id)
  `);

  const findBranchId = db.prepare('SELECT id FROM branches WHERE code = ?');

  const insertManyUsers = db.transaction((users) => {
    for (const user of users) {
      const branchId = user.branch_code ? findBranchId.get(user.branch_code)?.id : null;
      insertUser.run({
        username: user.username,
        password_hash: passwordHash,
        full_name: user.full_name,
        role: user.role,
        branch_id: branchId,
      });
    }
  });

  insertManyUsers(USERS);

  console.log(`🌱 [Seed] נוספו ${BRANCHES.length} סניפים (1 מחסן + 18) ו-${USERS.length} משתמשים`);
  console.log(`🌱 [Seed] סיסמה ראשונית לכולם: "${DEFAULT_PASSWORD}" (יש לשנות בפרודקשן!)`);
}
