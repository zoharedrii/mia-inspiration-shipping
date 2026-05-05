// Middleware לטיפול בשגיאות
// מבטיח שכל שגיאה תחזור ללקוח בפורמט אחיד וברור

// 404 - מטפל בנתיבים שלא קיימים
export function notFoundHandler(req, res, next) {
  res.status(404).json({
    error: 'נתיב לא נמצא',
    path: req.originalUrl,
    method: req.method,
  });
}

// טיפול כללי בכל שגיאה שזרקה הקוד
export function errorHandler(err, req, res, next) {
  // הדפסת השגיאה המלאה ל-console (רק בפיתוח)
  console.error('❌ שגיאה:', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'שגיאת שרת פנימית';

  res.status(statusCode).json({
    error: message,
    // מצרפים את ה-stack רק בסביבת פיתוח (לא בפרודקשן!)
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
}
