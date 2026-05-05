// המרת JSON ↔ XML עבור התקשורת עם אוריין
//
// אוריין מצפה ל-XML בפורמט DATACOLLECTION/DATA. עבודה ישירה עם XML מסורבלת,
// אז אנחנו עובדים עם JavaScript objects ומתרגמים בקצוות.

import { XMLBuilder, XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: true,
  trimValues: true,
  // אוריין משתמשת ב-CDATA לערכים - מחלצים אותם נכון
  cdataPropName: '__cdata',
});

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  format: true,
  indentBy: '  ',
  // לא לכלול תגיות ריקות שערכן undefined
  suppressEmptyNode: false,
});

/**
 * ממיר string XML לאובייקט JavaScript.
 *
 * @param {string} xml - מחרוזת ה-XML שהתקבלה מאוריין
 * @returns {object} - האובייקט המתאים
 */
export function parseXml(xml) {
  return parser.parse(xml);
}

/**
 * ממיר אובייקט JavaScript ל-string XML שאפשר לשלוח לאוריין.
 *
 * @param {object} obj - האובייקט להמרה
 * @returns {string} - מחרוזת XML
 */
export function buildXml(obj) {
  return builder.build(obj);
}
