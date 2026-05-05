// חיבור מרכזי ל-SQLite
//
// מקבץ אחד שכל הקוד שלנו משתמש בו לדבר עם ה-DB.
// יוצר את הקובץ אם הוא לא קיים, מאתחל את הסכמה, ומחזיר instance של DB.

import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { initSchema } from './schema.js';

const dbPath = resolve(process.env.DATABASE_PATH || './data/mia.db');

// וידוא שתיקיית data/ קיימת
mkdirSync(dirname(dbPath), { recursive: true });

// פתיחת חיבור (יוצר את הקובץ אם לא קיים)
const db = new Database(dbPath);

// WAL mode - ביצועים טובים יותר עבור קריאה+כתיבה במקביל
db.pragma('journal_mode = WAL');

// אתחול הסכמה
initSchema(db);

console.log(`💾 [DB] מחובר ל-${dbPath}`);

export default db;
