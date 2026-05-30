// עוזר ליצירת שגיאות עם קוד סטטוס HTTP.
// במקום new Error רגיל, מצרפים statusCode כדי שה-handler ידע איזה קוד להחזיר.
//
// שימוש:  throw httpError('המשלוח לא נמצא', 404);

export function httpError(message, statusCode) {
  return Object.assign(new Error(message), { statusCode });
}
