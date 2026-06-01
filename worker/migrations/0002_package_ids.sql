-- מוסיף עמודה לשמירת מזהי החבילות (PACKAGEID) שנשלחו לאוריין.
-- שומרים כמחרוזת מופרדת בפסיקים (למשל "748608800201,748608800202"),
-- בדיוק בפורמט ש-GetPackageStatus מצפה לו ב-?package=...
ALTER TABLE shipments ADD COLUMN package_ids TEXT;
