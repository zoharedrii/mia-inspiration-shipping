// תקשורת מול אוריין ליצירת הזמנות משלוח ומשיכת מדבקות.
//
// ORIAN_MODE:
//   "mock" - מדמה את אוריין מקומית (ברירת מחדל)
//   "live"  - קריאה אמיתית ל-API של אוריין

import { getToken } from './auth.js';
import { buildXml, parseXml } from './xml.js';

function isMockMode(env) {
  return (env.ORIAN_MODE || 'mock').toLowerCase() === 'mock';
}

/**
 * בונה את ה-headers לאימות מול אוריין לפי סוג הטוקן:
 * - סביבת טסט: הטוקן הוא "Basic ..." → header: Authorization
 * - סביבת פרודקשן: הטוקן הוא JWT אמיתי → header: AuthToken (כפי שאוריין מצפה)
 */
function buildAuthHeaders(token) {
  if (token.startsWith('Basic ')) {
    // הטסט-שרת של אוריין מחזיר "Authorized" במקום JWT.
    // משתמשים ב-Authorization: Basic ... כמו ב-Login רגיל.
    return { Authorization: token };
  }
  // פרודקשן: JWT אמיתי נשלח ב-header AuthToken
  return { AuthToken: token };
}

// ===================================================================
// יצירת מזהי חבילה (PACKAGEID) — מקס' 11 תווים לפי תיעוד אוריין
// ===================================================================

/**
 * מייצר מזהה חבילה ייחודי בן עד 11 ספרות.
 * פורמט: 8 ספרות מה-timestamp + 2 ספרות אינדקס החבילה = 10 ספרות.
 * לדוגמה: חבילה 3 של הזמנה בשעה 1748608800 → "7486088002"
 */
function generatePackageId(shipmentDbId, packageIndex) {
  // timestamp בשניות, 8 ספרות אחרונות + אינדקס 2 ספרות (01–99)
  const ts = String(Math.floor(Date.now() / 1000)).slice(-8);
  const idx = String(packageIndex + 1).padStart(2, '0');
  return `${ts}${idx}`;
}

// ===================================================================
// MOCK
// ===================================================================

async function createMockOrder({ shipment, sourceBranch, targetBranch }) {
  console.log(
    `🎭 [Orian Mock] הזמנה: ${shipment.reference_id} ` +
    `מ-${sourceBranch.name} ל-${targetBranch.name} (${shipment.package_count} מארזים)`
  );
  await new Promise((r) => setTimeout(r, 150));
  // מזהה mock: 12 ספרות, תחילית 99
  const mockId = `99${Math.floor(Math.random() * 1e10).toString().padStart(10, '0')}`;
  console.log(`🎭 [Orian Mock] orian_order_id = ${mockId}`);
  return { orian_order_id: mockId, source: 'mock' };
}

// ===================================================================
// LIVE — יצירת הזמנה
// ===================================================================

async function createLiveOrder(env, { shipment, sourceBranch, targetBranch }) {
  const consignee = env.ORIAN_CONSIGNEE;
  if (!consignee) throw new Error('חסר ORIAN_CONSIGNEE');

  const token = await getToken(env);

  // בניית רשימת PACKAGE — חבילה נפרדת לכל יחידה
  const packages = [];
  for (let i = 0; i < shipment.package_count; i++) {
    packages.push({
      PACKAGEID: generatePackageId(shipment.id, i),  // מקס' 11 תווים
      PACKAGEREFID: '',
      PACKAGETYPE: shipment.package_type || '02',
      DOCUMENTTYPE: 'TRANSPORTATION',
      CONSIGNEE: '',
      DOCUMENTID: '',
    });
  }

  const payload = {
    DATACOLLECTION: {
      DATA: {
        TABLENAME: 'TRANSPORTATIONORDER',
        CONSIGNEE: consignee,
        TRANSPORTATIONORDERID: '',
        ORDERTYPE: 'REGULAR',
        // REFERENCEORDER הוא המזהה שלנו — ישמש גם למשיכת מדבקה
        HOSTORDERID: shipment.reference_id,
        REFERENCEORDER: shipment.reference_id,
        PACKAGETYPE: shipment.package_type || '02',
        UNITS: shipment.package_count,
        ORIGINALUNITS: 0,
        ORDERWEIGHT: 0,
        ORDERVOLUME: 0,
        ORDERVALUE: 0,
        TRANSPORTATIONTYPE: 'DOMESTIC',
        SERVICETYPE: 'NEXTDAY',
        PAYMENTTYPE: 'CREDIT',
        NOTES: shipment.notes || '',
        COLLECTNEEDED: 0,
        RETURNPACKAGE: 0,
        SIGNEDDOC: 0,
        CONFDOC: 0,
        ORDERPRIORITY: 0,
        UNKNOWNPACKAGES: 0,
        SOURCECONTACT: {
          CONTACTTYPE: 'PICKUP',
          CONTACTID: '',
          // STREET1 = כתובת מלאה כולל מספר בית (כפי שמותר לפי התיעוד)
          STREET1: sourceBranch.address || sourceBranch.name,
          STREET2: '',
          FLOOR: '',
          CITY: sourceBranch.city || '',
          ZIP: sourceBranch.zip || '',
          ORIGINALADDRESS: '',
          SITENAME: sourceBranch.name,
          CONTACT1NAME: sourceBranch.contact_name || sourceBranch.name,
          CONTACT1PHONE: sourceBranch.contact_phone || '',
          ADDRESSTYPE: '02',  // Business
          CONTACT2PHONE: '',
          CONTACTIDNUMBE: '',
          CONTACT1EMAIL: '',
        },
        TARGETCONTACT: {
          CONTACTTYPE: 'DELIVERY',
          CONTACTID: '',
          STREET1: targetBranch.address || targetBranch.name,
          STREET2: '',
          FLOOR: '',
          CITY: targetBranch.city || '',
          ZIP: targetBranch.zip || '',
          ORIGINALADDRESS: '',
          SITENAME: targetBranch.name,
          CONTACT1NAME: targetBranch.contact_name || targetBranch.name,
          CONTACT1PHONE: targetBranch.contact_phone || '',
          ADDRESSTYPE: '02',  // Business (סניפים פנים-ארגוניים)
          CONTACT2PHONE: '',
          CONTACT1EMAIL: '',
          CONTACTIDNUMBE: '',
        },
        PACKAGES: {
          PACKAGE: packages.length === 1 ? packages[0] : packages,
        },
      },
    },
  };

  const xml = buildXml(payload);

  const response = await fetch(`${env.ORIAN_BASE_URL}/CreateTransportationOrder`, {
    method: 'POST',
    headers: {
      ...buildAuthHeaders(token),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `xmldata=${encodeURIComponent(xml)}`,
  });

  if (!response.ok) {
    throw new Error(`יצירת הזמנה באוריין נכשלה (HTTP ${response.status})`);
  }

  // ניתוח תגובת ה-XML מאוריין
  const responseText = await response.text();
  let success = false;
  let errorMsg = '';
  try {
    const parsed = parseXml(responseText);
    const resp = parsed?.DATACOLLECTION?.RESPONSE;
    success = String(resp?.SUCCESS).toLowerCase() === 'true';
    errorMsg = resp?.RESPONSEERROR || '';
  } catch {
    // אם הניתוח נכשל נניח הצלחה אם ה-HTTP היה 200
    success = true;
  }

  if (!success) {
    throw new Error(`אוריין דחתה את ההזמנה: ${errorMsg}`);
  }

  // התגובה לא מחזירה TRANSPORTATIONORDERID — משתמשים ב-reference_id
  console.log(`✅ [Orian Live] הזמנה נוצרה: ${shipment.reference_id}`);
  return {
    orian_order_id: shipment.reference_id,
    source: 'live',
  };
}

// ===================================================================
// LIVE — משיכת מדבקת שילוח (PDF ב-Base64)
// ===================================================================

/**
 * מושך מדבקת שילוח מאוריין עבור הזמנה.
 * מחזיר string של Base64 PDF.
 *
 * הערה: URL עם שגיאת כתיב מכוונת — כך כתוב בתיעוד הרשמי של אוריין.
 *
 * @param {object} env
 * @param {string} referenceId - ה-REFERENCEORDER שנשלח בעת יצירת ההזמנה
 * @returns {Promise<string>} Base64 PDF
 */
export async function getTransportationOrderLabel(env, referenceId) {
  if (isMockMode(env)) {
    throw new Error('מדבקות אמיתיות זמינות רק במצב live — בדקי ORIAN_MODE');
  }

  const consignee = env.ORIAN_CONSIGNEE;
  if (!consignee) throw new Error('חסר ORIAN_CONSIGNEE');

  const token = await getToken(env);

  const payload = {
    DATACOLLECTION: {
      DATA: {
        CONSIGNEE: consignee,
        ORDERID: referenceId,  // REFERENCEORDER שנשלח ב-CreateTransportationOrder
      },
    },
  };

  const xml = buildXml(payload);

  // שגיאת כתיב "Transporrtaion" — כך בדיוק מוגדר ב-API של אוריין
  const response = await fetch(`${env.ORIAN_BASE_URL}/GetTransporttaionOrderLabel`, {
    method: 'POST',
    headers: {
      ...buildAuthHeaders(token),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `xmldata=${encodeURIComponent(xml)}`,
  });

  if (!response.ok) {
    throw new Error(`משיכת מדבקה מאוריין נכשלה (HTTP ${response.status})`);
  }

  const responseText = await response.text();

  // ניתוח XML — המדבקה נמצאת ב-<LABEL><![CDATA[...base64...]]></LABEL>
  let labelBase64 = null;
  let success = false;
  try {
    const parsed = parseXml(responseText);
    const resp = parsed?.DATACOLLECTION?.RESPONSE;
    success = String(resp?.SUCCESS).toLowerCase() === 'true';
    labelBase64 = resp?.LABEL?.__cdata || resp?.LABEL;
  } catch {
    throw new Error('שגיאה בניתוח תגובת המדבקה מאוריין');
  }

  if (!success || !labelBase64) {
    throw new Error(`לא התקבלה מדבקה מאוריין (הזמנה: ${referenceId})`);
  }

  return labelBase64;  // Base64 PDF
}

// ===================================================================
// נקודת כניסה ראשית
// ===================================================================

export async function createTransportationOrder(env, { shipment, sourceBranch, targetBranch }) {
  if (isMockMode(env)) {
    return createMockOrder({ shipment, sourceBranch, targetBranch });
  }
  return createLiveOrder(env, { shipment, sourceBranch, targetBranch });
}
