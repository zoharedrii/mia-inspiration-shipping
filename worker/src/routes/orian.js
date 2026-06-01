// Routes לבדיקת התקשורת עם אוריין.

import { Hono } from 'hono';
import * as orian from '../services/orian/index.js';
import { buildXml } from '../services/orian/xml.js';

const router = new Hono();

/**
 * GET /api/orian/test - בודק חיבור לאוריין על ידי ביצוע Login.
 */
router.get('/test', async (c) => {
  try {
    const token = await orian.login(c.env);
    return c.json({
      status: 'ok',
      message: '✅ התחברות לאוריין הצליחה — AuthToken התקבל',
      tokenReceived: Boolean(token),
      environment: c.env.ORIAN_BASE_URL,
    });
  } catch (error) {
    return c.json(
      {
        status: 'error',
        message: '❌ התחברות לאוריין נכשלה',
        reason: error.message,
        hint: 'בדקי שהמשתנים ORIAN_USERNAME, ORIAN_PASSWORD ו-ORIAN_BASE_URL מוגדרים נכון',
        environment: c.env.ORIAN_BASE_URL || '(לא מוגדר)',
      },
      500
    );
  }
});

/**
 * GET /api/orian/debug - שולח CreateTransportationOrder מינימלי ומחזיר תשובה מלאה.
 * לדיבאג בלבד — להסיר אחרי שהבעיה נפתרת.
 */
router.get('/debug', async (c) => {
  const steps = [];

  // שלב 1: Login — מציג את כל התשובה (headers + body)
  let token = null;
  try {
    const username = c.env.ORIAN_USERNAME;
    const password = c.env.ORIAN_PASSWORD;
    const credentials = btoa(`${username}:${password}`);

    const loginRes = await fetch(`${c.env.ORIAN_BASE_URL}/Login`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    const loginBody = await loginRes.text();
    const loginHeaders = Object.fromEntries(loginRes.headers.entries());

    steps.push({
      step: 'login_raw',
      httpStatus: loginRes.status,
      responseHeaders: loginHeaders,
      responseBody: loginBody,
      note: 'כל ה-headers מ-Login — מחפשים AuthToken/token/Set-Token/X-Auth וכו\'',
    });

    token = await orian.login(c.env);
    steps.push({ step: 'login', status: 'ok', token, tokenLength: token?.length });
  } catch (err) {
    steps.push({ step: 'login', status: 'error', error: err.message });
    return c.json({ steps });
  }

  // שלב 2: בניית XML מינימלי ושליחה ל-CreateTransportationOrder
  // הטוקן (GUID מ-header authtoken) נשלח כ-AuthToken
  const authHeader = { AuthToken: token };
  steps.push({ step: 'auth_headers', headers: Object.keys(authHeader) });
  const consignee = c.env.ORIAN_CONSIGNEE || '30000060';
  const testXml = buildXml({
    DATACOLLECTION: {
      DATA: {
        TABLENAME: 'TRANSPORTATIONORDER',
        CONSIGNEE: consignee,
        TRANSPORTATIONORDERID: '',
        ORDERTYPE: 'REGULAR',
        HOSTORDERID: 'DBG-TEST-001',
        REFERENCEORDER: 'DBG-TEST-001',
        PACKAGETYPE: '02',
        UNITS: 1,
        ORIGINALUNITS: 0,
        ORDERWEIGHT: 0,
        ORDERVOLUME: 0,
        ORDERVALUE: 0,
        TRANSPORTATIONTYPE: 'DOMESTIC',
        SERVICETYPE: 'NEXTDAY',
        PAYMENTTYPE: 'CREDIT',
        NOTES: 'debug test',
        COLLECTNEEDED: 0,
        RETURNPACKAGE: 0,
        SIGNEDDOC: 0,
        CONFDOC: 0,
        ORDERPRIORITY: 0,
        UNKNOWNPACKAGES: 0,
        SOURCECONTACT: {
          CONTACTTYPE: 'PICKUP',
          CONTACTID: '',
          STREET1: 'רחוב הבדיקה 1',
          STREET2: '',
          FLOOR: '',
          CITY: 'תל אביב',
          ZIP: '',
          ORIGINALADDRESS: '',
          SITENAME: 'מחסן מרכזי',
          CONTACT1NAME: 'בדיקה',
          CONTACT1PHONE: '0501234567',
          ADDRESSTYPE: '02',
          CONTACT2PHONE: '',
          CONTACTIDNUMBE: '',
          CONTACT1EMAIL: '',
        },
        TARGETCONTACT: {
          CONTACTTYPE: 'DELIVERY',
          CONTACTID: '',
          STREET1: 'רחוב הגמר 5',
          STREET2: '',
          FLOOR: '',
          CITY: 'חיפה',
          ZIP: '',
          ORIGINALADDRESS: '',
          SITENAME: 'סניף חיפה',
          CONTACT1NAME: 'בדיקה',
          CONTACT1PHONE: '0521234567',
          ADDRESSTYPE: '02',
          CONTACT2PHONE: '',
          CONTACT1EMAIL: '',
          CONTACTIDNUMBE: '',
        },
        PACKAGES: {
          PACKAGE: {
            PACKAGEID: '1234567890',
            PACKAGEREFID: '',
            PACKAGETYPE: '02',
            DOCUMENTTYPE: 'TRANSPORTATION',
            CONSIGNEE: '',
            DOCUMENTID: '',
          },
        },
      },
    },
  });

  try {
    const res = await fetch(`${c.env.ORIAN_BASE_URL}/CreateTransportationOrder`, {
      method: 'POST',
      headers: {
        ...authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `xmldata=${encodeURIComponent(testXml)}`,
    });
    const body = await res.text();
    steps.push({
      step: 'CreateTransportationOrder',
      status: res.ok ? 'ok' : 'error',
      httpStatus: res.status,
      httpStatusText: res.statusText,
      responseHeaders: Object.fromEntries(res.headers.entries()),
      responseBody: body,
      xmlSent: testXml,
    });
  } catch (err) {
    steps.push({ step: 'CreateTransportationOrder', status: 'fetch_error', error: err.message });
  }

  return c.json({ steps, env: { ORIAN_BASE_URL: c.env.ORIAN_BASE_URL, ORIAN_MODE: c.env.ORIAN_MODE, hasConsignee: Boolean(c.env.ORIAN_CONSIGNEE), hasUsername: Boolean(c.env.ORIAN_USERNAME) } });
});

export default router;
