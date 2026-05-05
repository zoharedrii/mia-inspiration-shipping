// נתוני התחלה (Seed Data)
//
// מאכלס את ה-DB בנתוני בדיקה כשהוא ריק:
// - מחסן מרכזי + 5 סניפים לדוגמה
// - 1 משתמש מנהל (admin)
// - 1 משתמש מחסן
// - 2 משתמשי סניף
//
// הסיסמה הראשונית של כולם: "password123" (לפיתוח בלבד!)
// בפרודקשן יש להחליף סיסמאות אלו מיד.

import bcrypt from 'bcrypt';
import db from './index.js';

const BCRYPT_ROUNDS = 10;
const DEFAULT_PASSWORD = 'password123';

// 5 סניפים לדוגמה (מתוך 18 ברשת האמיתית) + מחסן מרכזי
const BRANCHES = [
  {
    code: 'WH-CENTRAL',
    name: 'מחסן מרכזי - שוהם',
    address: 'הרימון 8',
    city: 'שוהם',
    zip: '6082935',
    phone: '03-1234567',
    contact_name: 'שמעון מחסנאי',
    contact_phone: '0508754123',
    is_warehouse: 1,
  },
  {
    code: 'BR-TLV-01',
    name: 'מייה תל אביב - דיזנגוף',
    address: 'דיזנגוף 50',
    city: 'תל אביב',
    zip: '6433201',
    phone: '03-7654321',
    contact_name: 'מנהלת סניף תל אביב',
    contact_phone: '0501111111',
    is_warehouse: 0,
  },
  {
    code: 'BR-JLM-01',
    name: 'מייה ירושלים - ממילא',
    address: 'אלרוב ממילא 5',
    city: 'ירושלים',
    zip: '9414505',
    contact_name: 'מנהלת סניף ירושלים',
    contact_phone: '0502222222',
    is_warehouse: 0,
  },
  {
    code: 'BR-HFA-01',
    name: 'מייה חיפה - הקריון',
    address: 'דרך עכו 2',
    city: 'קריית ביאליק',
    zip: '2722302',
    contact_name: 'מנהלת סניף חיפה',
    contact_phone: '0503333333',
    is_warehouse: 0,
  },
  {
    code: 'BR-BSH-01',
    name: 'מייה באר שבע - גרנד',
    address: 'הנשיאים 64',
    city: 'באר שבע',
    zip: '8489116',
    contact_name: 'מנהלת סניף באר שבע',
    contact_phone: '0504444444',
    is_warehouse: 0,
  },
  {
    code: 'BR-RAA-01',
    name: 'מייה רעננה - רננים',
    address: 'אחוזה 187',
    city: 'רעננה',
    zip: '4365413',
    contact_name: 'מנהלת סניף רעננה',
    contact_phone: '0505555555',
    is_warehouse: 0,
  },
];

const USERS = [
  {
    username: 'admin',
    full_name: 'מנהל מערכת',
    role: 'admin',
    branch_code: null,
  },
  {
    username: 'warehouse',
    full_name: 'מנהל מחסן',
    role: 'warehouse',
    branch_code: 'WH-CENTRAL',
  },
  {
    username: 'tlv',
    full_name: 'מנהלת סניף תל אביב',
    role: 'branch',
    branch_code: 'BR-TLV-01',
  },
  {
    username: 'jlm',
    full_name: 'מנהלת סניף ירושלים',
    role: 'branch',
    branch_code: 'BR-JLM-01',
  },
];

/**
 * בודק אם ה-DB ריק. אם כן - מאכלס אותו.
 * אם יש כבר נתונים - לא נוגע (כדי לא לדרוס שינויים שעשיתן ידנית).
 */
export async function seedIfEmpty() {
  const branchCount = db.prepare('SELECT COUNT(*) AS c FROM branches').get().c;

  if (branchCount > 0) {
    console.log(`🌱 [Seed] ה-DB כבר מאוכלס (${branchCount} סניפים) - מדלגת על seed`);
    return;
  }

  console.log('🌱 [Seed] ה-DB ריק - מאכלסת בנתוני התחלה...');

  // הצפנת הסיסמה הדיפולטיבית פעם אחת
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, BCRYPT_ROUNDS);

  // הכנסת סניפים בעסקה אחת (מהיר ובטוח)
  const insertBranch = db.prepare(`
    INSERT INTO branches (code, name, address, city, zip, phone, contact_name, contact_phone, is_warehouse)
    VALUES (@code, @name, @address, @city, @zip, @phone, @contact_name, @contact_phone, @is_warehouse)
  `);

  const insertManyBranches = db.transaction((branches) => {
    for (const branch of branches) {
      insertBranch.run({
        zip: null,
        phone: null,
        contact_name: null,
        contact_phone: null,
        ...branch,
      });
    }
  });

  insertManyBranches(BRANCHES);

  // הכנסת משתמשים - מצריך מיפוי branch_code → branch_id
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

  console.log(`🌱 [Seed] נוספו ${BRANCHES.length} סניפים ו-${USERS.length} משתמשים`);
  console.log(`🌱 [Seed] סיסמה ראשונית לכולם: "${DEFAULT_PASSWORD}" (יש לשנות בפרודקשן!)`);
}
