// המרת JSON ↔ XML עבור התקשורת עם אוריין.
//
// אוריין מצפה ל-XML בפורמט DATACOLLECTION/DATA. עובדים עם JavaScript objects
// ומתרגמים בקצוות. fast-xml-parser הוא ספרייה טהורה ב-JS - רצה גם על Workers.

import { XMLBuilder, XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: true,
  trimValues: true,
  cdataPropName: '__cdata',
});

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  format: true,
  indentBy: '  ',
  // חשוב: אוריין דורשת תגיות-ריקות סוגרות-עצמן (<TAG/>) ולא <TAG></TAG>.
  // אחרת ה-XML parser בצד אוריין קורס עם "Object reference not set to an instance of an object".
  suppressEmptyNode: true,
  // עוטף ערכים שמגיעים כ-{ __cdata: 'טקסט' } ב-<![CDATA[...]]>.
  // נחוץ לשדות בעברית כדי שאוריין תקרא אותם נכון (במקום סימני שאלה).
  cdataPropName: '__cdata',
});

/**
 * ממיר string XML לאובייקט JavaScript.
 */
export function parseXml(xml) {
  return parser.parse(xml);
}

/**
 * ממיר אובייקט JavaScript ל-string XML שאפשר לשלוח לאוריין.
 */
export function buildXml(obj) {
  return builder.build(obj);
}
