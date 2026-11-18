-- מוסיף לכל סניף את המספר שלו במערכת האיסוף מסניף (branch-pickup).
-- שתי המערכות ממספרות סניפים אחרת, אז שומרים כאן את ההתאמה.
-- סניף בלי pickup_branch_id (NULL) לא יכול לסרוק חבילות לאיסוף.
-- סניף 17 (אבנת פתח תקווה) לא פעיל ולכן לא מותאם.

ALTER TABLE branches ADD COLUMN pickup_branch_id INTEGER;

UPDATE branches SET pickup_branch_id = 2  WHERE branch_number = 11; -- איילון → קניון איילון
UPDATE branches SET pickup_branch_id = 7  WHERE branch_number = 12; -- רחובות → עופר רחובות
UPDATE branches SET pickup_branch_id = 5  WHERE branch_number = 13; -- זהב ראשל"צ → קניון הזהב
UPDATE branches SET pickup_branch_id = 3  WHERE branch_number = 14; -- גבעתיים → עזריאלי גבעתיים
UPDATE branches SET pickup_branch_id = 14 WHERE branch_number = 15; -- גרנד חיפה → גרנד קניון חיפה
UPDATE branches SET pickup_branch_id = 16 WHERE branch_number = 16; -- קריון → הקריון קריית ביאליק
UPDATE branches SET pickup_branch_id = 10 WHERE branch_number = 18; -- ביג אשדוד → אשדוד ביג פאשן
UPDATE branches SET pickup_branch_id = 4  WHERE branch_number = 19; -- עזריאלי ת"א → עזריאלי תל אביב
UPDATE branches SET pickup_branch_id = 11 WHERE branch_number = 20; -- עזריאלי חולון → קניון עזריאלי חולון
UPDATE branches SET pickup_branch_id = 17 WHERE branch_number = 21; -- גרנד ב"ש → גרנד באר שבע
UPDATE branches SET pickup_branch_id = 8  WHERE branch_number = 22; -- עיר ימים נתניה → נתניה עיר ימים
UPDATE branches SET pickup_branch_id = 18 WHERE branch_number = 23; -- ביג ב"ש → ביג באר שבע
UPDATE branches SET pickup_branch_id = 6  WHERE branch_number = 26; -- רוטשילד ראשל"צ → רוטשילד ראשון לציון
UPDATE branches SET pickup_branch_id = 12 WHERE branch_number = 27; -- מלחה → מלחה ירושלים
UPDATE branches SET pickup_branch_id = 13 WHERE branch_number = 28; -- ממילא → מתחם ממילא ירושלים
UPDATE branches SET pickup_branch_id = 9  WHERE branch_number = 29; -- ביג גלילות → גלילות ביג פאשן
UPDATE branches SET pickup_branch_id = 15 WHERE branch_number = 30; -- חוצות המפרץ → חוצות המפרץ אאוטלט
