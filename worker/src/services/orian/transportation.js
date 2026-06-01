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
 * בונה את ה-header לאימות מול אוריין.
 * הטוקן (GUID בטסט / JWT בפרודקשן) נשלח תמיד ב-header "AuthToken".
 */
function buildAuthHeaders(token) {
  return { AuthToken: token };
}

/**
 * שולח בקשת POST לאוריין בפורמט הנדרש.
 *
 * חשוב (לפי הנחיית רועי מאוריין): אוריין מצפה שה-XML יישלח כשדה-טופס עם
 * מפתח ריק — כלומר הגוף חייב להתחיל ב-"=" ואז ה-<DATACOLLECTION>:
 *     =<DATACOLLECTION>...</DATACOLLECTION>
 * ו-Content-Type חייב להיות application/x-www-form-urlencoded.
 * בלי ה-"=" אוריין קוראת Request.Form[""] ומקבלת null → קריסת .NET
 * ("Value cannot be null. Parameter name: s").
 *
 * @param {string} url - כתובת ה-endpoint המלאה
 * @param {string} token - טוקן האימות
 * @param {string} xml - גוף ה-XML (ללא הצהרת <?xml?>)
 * @returns {Promise<Response>}
 */
function postToOrian(url, token, xml) {
  return fetch(url, {
    method: 'POST',
    headers: {
      ...buildAuthHeaders(token),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    // ה-"=" לפני ה-XML הופך אותו לשדה-טופס עם מפתח ריק
    body: `=${xml}`,
  });
}

/**
 * מחלץ את אלמנט ה-RESPONSE מתוך תגובת אוריין.
 * אוריין עוטפת לעיתים את ה-XML בתוך <string>...</string> כשהתוכן מקודד (&lt;),
 * ולכן גישה ישירה ל-DATACOLLECTION.RESPONSE נכשלת. הפונקציה מטפלת בשני המקרים.
 * @returns {object|null} אובייקט ה-RESPONSE, או null אם לא נמצא
 */
function extractOrianResponse(responseText) {
  let parsed;
  try {
    parsed = parseXml(responseText);
  } catch {
    return null;
  }

  // מקרה רגיל: <DATACOLLECTION><RESPONSE>...</RESPONSE></DATACOLLECTION>
  if (parsed?.DATACOLLECTION?.RESPONSE) {
    return parsed.DATACOLLECTION.RESPONSE;
  }

  // מקרה עטיפה: <string>...XML מקודד...</string>
  const wrapped = parsed?.string;
  if (typeof wrapped === 'string') {
    try {
      const inner = parseXml(wrapped);
      if (inner?.DATACOLLECTION?.RESPONSE) return inner.DATACOLLECTION.RESPONSE;
    } catch {
      return null;
    }
  } else if (wrapped?.DATACOLLECTION?.RESPONSE) {
    return wrapped.DATACOLLECTION.RESPONSE;
  }

  return null;
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

  // אוריין דורשת *גוף מלא* — כל שדות הסכמה חייבים להופיע, גם אם ריקים.
  // אחרת ה-parser של אוריין קורס עם NPE ("Object reference not set...").
  // הסדר והשדות תואמים לדוגמה הרשמית של אוריין (Create Transportation One Package).
  // שדות שאין לנו נתון עבורם נשארים '' (ריקים) — fast-xml-parser ייצר <TAG/>.
  const payload = {
    DATACOLLECTION: {
      DATA: {
        TABLENAME: 'TRANSPORTATIONORDER',
        CONSIGNEE: consignee,
        TRANSPORTATIONORDERID: '',
        ORDERTYPE: 'REGULAR',
        STATUS: '',
        PAYINGCUSTOMER: '',
        SOURCECOMPANY: '',
        SOURCECOMPANYTYPE: '',
        SOURCECONTACTID: '',
        SOURCEPUDUNAME: '',
        SOURCEPUDUPHONE: '',
        TARGETCOMPANY: '',
        TARGETCOMPANYTYPE: '',
        TARGETCONTACTID: '',
        TARGETPUDUNAME: '',
        TARGETPUDUPHONE: '',
        PICKUPBRANCH: '',
        DELIVERYBRANCH: '',
        PICKUPDEPOT: '',
        DELIVERYDEPOT: '',
        DRAFTCREATEDATE: '',
        CREATEDATE: '',
        REQUESTEDPICKUPDATE: '',
        REQPICKUPENDDATE: '',
        REQUESTEDDELIVERYDATE: '',
        REQDELENDDATE: '',
        REQUESTEDORIGINALDATE: '',
        SCHEDULEDDATE: '',
        STATUSDATE: '',
        COMPLETIONDATE: '',
        // HOSTORDERID / REFERENCEORDER = המזהה שלנו — ישמש גם למשיכת מדבקה
        HOSTORDERID: shipment.reference_id,
        REFERENCEORDER: shipment.reference_id,
        REFERENCEORDER2: '',
        DELIVERYNOTE: '',
        INTERNALDELIVERYNOTE: '',
        CONTAINERNUMBER: '',
        REFCOMPANYCODE: '',
        REFCOMPANYNAME: '',
        REFCOMPANYCONTACT: '',
        PACKAGETYPE: shipment.package_type || '02',
        UNITS: shipment.package_count,
        ORIGINALUNITS: 0,
        ORDERWEIGHT: 0,
        ORDERVOLUME: 0,
        ORDERVALUE: 0,
        TRANSPORTATIONTYPE: 'DOMESTIC',
        SERVICETYPE: 'NEXTDAY',
        TRANSPORTATIONCLASS: '',
        HAZARDCLASS: '',
        HAZARDCOMMENTS: '',
        CARGOTYPE: '',
        LOADTYPE: '',
        SECURITYCLASS: '',
        STORAGELOCATION: '',
        NOTES: shipment.notes || '',
        PICKUPCOMMENTS: '',
        DELIVERYCOMMENTS: '',
        CHARGECOMMENTS: '',
        ORDERPRICE: 0,
        CALCULATEDPRICE: 0,
        PRICECALCULATIONDATE: '',
        CHARGEID: '',
        AGREEMENTCODE: '',
        CHARGED: 0,
        CARRIERCREDITED: 0,
        ORDERCOST: 0,
        CALCULATEDCOST: 0,
        COSTCALCULATIONDATE: '',
        COSTCHARGEID: '',
        PAYMENTTYPE: 'CREDIT',
        ORIGINALORDERID: '',
        COLLECTNEEDED: 0,
        COLLECTSUM: 0,
        COLLECTCHEQUE1: 0,
        COLLECTCHEQUE1DATE: '',
        COLLECTCHEQUE2: 0,
        COLLECTCHEQUE2DATE: '',
        COLLECTCHEQUE3: 0,
        COLLECTCHEQUE3DATE: '',
        COLLECTRECEIPT: '',
        RETURNPACKAGE: 0,
        RETURNPACKAGETYPE: '',
        SIGNEDDOC: 0,
        CONFDOC: 0,
        ORDERPRIORITY: 0,
        DELIVERYCONFIRMATIONTYPE: '',
        IDPIC: '',
        ACTIVITYSTATUS: '',
        SHORTAGE: 0,
        UNKNOWNPACKAGES: 0,
        ROUTINGSET: '',
        CHKPNT: '',
        DELIVERYPOINT: '',
        MANUALHANDLING: 0,
        SCHEDULINGSTATUS: '',
        SCHEDULINGFAILCODE: '',
        SCHEDULINGFAILNOTES: '',
        SCHEDULINGSTATUSDATE: '',
        DELIVERYLOCATION: '',
        DELIVERYRECIPIENT: '',
        ADDDATE: '',
        ADDUSER: '',
        EDITDATE: '',
        EDITUSER: '',
        ALLOWCONVERTTOPUDO: '',
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

  const createUrl = `${env.ORIAN_BASE_URL}/CreateTransportationOrder`;
  console.log(`📤 [Orian] CreateTransportationOrder → ${createUrl}`);
  console.log(`📤 [Orian] shipment: ${shipment.reference_id}`);
  console.log(`📤 [Orian] XML payload (ראשית 500 תווים): ${xml.slice(0, 500)}`);

  // אוריין מצפה ל-"=" + XML כשדה-טופס (ראה postToOrian).
  const response = await postToOrian(createUrl, token, xml);

  const responseText = await response.text();
  console.log(`📥 [Orian] CreateTransportationOrder HTTP ${response.status}: ${responseText.slice(0, 500)}`);

  if (!response.ok) {
    throw new Error(`יצירת הזמנה באוריין נכשלה (HTTP ${response.status}): ${responseText.slice(0, 300)}`);
  }

  // ניתוח תגובת ה-XML מאוריין (responseText כבר נקרא למעלה).
  // אוריין מחזירה חיווי במבנה: <RESPONSE><SUCCESS>true/false</SUCCESS>
  //   <STATUSCODE>200/100</STATUSCODE><RESPONSEERROR>...</RESPONSEERROR></RESPONSE>
  const resp = extractOrianResponse(responseText);

  // אם לא הצלחנו לפענח את התשובה בכלל — מתעדים את הגוף הגולמי לאבחון
  if (!resp) {
    throw new Error(`תשובת אוריין לא מזוהה (HTTP ${response.status}): ${responseText.slice(0, 300)}`);
  }

  const success = String(resp.SUCCESS).toLowerCase() === 'true';
  const statusCode = resp.STATUSCODE ?? '';
  const errorMsg = resp.RESPONSEERROR || '';
  console.log(`📥 [Orian] חיווי: SUCCESS=${success} | STATUSCODE=${statusCode} | RESPONSEERROR=${errorMsg}`);

  if (!success) {
    throw new Error(`אוריין דחתה את ההזמנה (STATUSCODE ${statusCode}): ${errorMsg || 'ללא פירוט'}`);
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
  const url = `${env.ORIAN_BASE_URL}/GetTransporttaionOrderLabel`;

  console.log(`📤 [Orian] GetTransporttaionOrderLabel → referenceId: ${referenceId}`);
  console.log(`📤 [Orian] XML body:\n${xml}`);

  // אותו סגנון בקשה כמו CreateTransportationOrder: "=" + XML כשדה-טופס.
  const response = await postToOrian(url, token, xml);
  const responseText = await response.text();
  console.log(`📥 [Orian] GetLabel HTTP ${response.status}: ${responseText.slice(0, 300)}`);

  if (!response.ok) {
    throw new Error(`משיכת מדבקה מאוריין נכשלה (HTTP ${response.status}): ${responseText.slice(0, 200)}`);
  }

  // ניתוח XML — המדבקה ב-<LABEL><![CDATA[...base64...]]></LABEL>.
  // אם להזמנה כמה חבילות, אוריין מחזירה כמה תגיות LABEL (מערך).
  const resp = extractOrianResponse(responseText);
  const success = String(resp?.SUCCESS).toLowerCase() === 'true';
  const labels = extractLabels(resp);

  if (!success || labels.length === 0) {
    throw new Error(`לא התקבלה מדבקה מאוריין (הזמנה: ${referenceId})`);
  }

  console.log(`✅ [Orian] התקבלו ${labels.length} מדבקות`);
  return labels;  // מערך של Base64 PDF (לפחות אחד)
}

/**
 * מחלץ את כל מחרוזות ה-Base64 של המדבקות מתוך תגובת אוריין.
 * תומך גם במדבקה בודדת וגם במספר מדבקות (מספר תגיות <LABEL>).
 * @returns {string[]} מערך של מחרוזות Base64 (יכול להיות ריק)
 */
function extractLabels(resp) {
  if (!resp) return [];
  const raw = resp.LABEL;
  if (!raw) return [];
  // fast-xml-parser מחזיר מערך כשיש כמה תגיות LABEL, או ערך בודד כשיש אחת
  const items = Array.isArray(raw) ? raw : [raw];
  return items
    .map((item) => (item && typeof item === 'object' ? item.__cdata : item))
    .filter((s) => typeof s === 'string' && s.length > 0);
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
