-- מילוי כתובות אמיתיות לכל סניפי החנויות (מקור: זוהר, מאתר הסניפים הרשמי).
-- ההתאמה לפי branch_number (השדה היציב). המחסן המרכזי (id=1) כבר מלא ולא נוגעים בו.
-- שדה address מכיל רחוב + מספר בלבד; העיר כבר קיימת בעמודת city נפרדת.

UPDATE branches SET address = 'דרך אבא הלל 301'        WHERE branch_number = 11; -- מייה איילון
UPDATE branches SET address = 'ביל''ו 2'                WHERE branch_number = 12; -- מייה רחובות
UPDATE branches SET address = 'דוד סחרוב 21'           WHERE branch_number = 13; -- מייה זהב ראשל"צ
UPDATE branches SET address = 'דרך יצחק רבין 53'       WHERE branch_number = 14; -- מייה גבעתיים
UPDATE branches SET address = 'דרך שמחה גולן 54'       WHERE branch_number = 15; -- מייה גרנד חיפה
UPDATE branches SET address = 'דרך עכו 192'            WHERE branch_number = 16; -- מייה קריון
UPDATE branches SET address = 'זאב ז''בוטינסקי 72'     WHERE branch_number = 17; -- מייה אבנת פ"ת
UPDATE branches SET address = 'דרך הרכבת 1'            WHERE branch_number = 18; -- מייה ביג אשדוד
UPDATE branches SET address = 'דרך מנחם בגין 132'      WHERE branch_number = 19; -- מייה עזריאלי ת"א
UPDATE branches SET address = 'גולדה מאיר 7'           WHERE branch_number = 20; -- מייה עזריאלי חולון
UPDATE branches SET address = 'שדרות דוד טוביהו 125'   WHERE branch_number = 21; -- מייה גרנד באר שבע
UPDATE branches SET address = 'בני ברמן 2'             WHERE branch_number = 22; -- מייה עיר ימים נתניה
UPDATE branches SET address = 'דרך חברון 21'           WHERE branch_number = 23; -- מייה ביג באר שבע
UPDATE branches SET address = 'רוטשילד 50'             WHERE branch_number = 26; -- מייה רוטשילד ראשל"צ
UPDATE branches SET address = 'דרך אגודת ספורט בית"ר 1' WHERE branch_number = 27; -- מייה מלחה ירושלים
UPDATE branches SET address = 'יפו 37'                 WHERE branch_number = 28; -- מייה ממילא ירושלים
UPDATE branches SET address = 'כביש החוף'              WHERE branch_number = 29; -- מייה ביג גלילות
UPDATE branches SET address = 'החרושת 9', zip = '12068' WHERE branch_number = 30; -- מייה חוצות המפרץ

-- עדכון פרטי המחסן הראשי (id=1): מספר סניף 10, כתובת + טלפון אמיתיים, וריקון מיקוד ישן.
UPDATE branches
SET branch_number = 10,
    address = 'המייסדים 1',
    city = 'בית עובד',
    contact_phone = '050-5594083',
    zip = NULL
WHERE code = 'WH-CENTRAL';

-- איש קשר גנרי לסניפי החנויות (לא לכל סניף יש מנהל/ת). המחסן שומר על "מנהל מחסן".
UPDATE branches
SET contact_name = 'צוות הסניף'
WHERE is_warehouse = 0 AND (contact_name IS NULL OR contact_name = '');
