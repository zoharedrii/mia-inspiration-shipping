// תקשורת מול אוריין ליצירת הזמנות משלוח
//
// משנה ENV: ORIAN_MODE
//   - "mock" (ברירת מחדל) - מדמה את אוריין לוקלית, מחזיר מזהי מעקב סימולציה
//   - "live" - קריאה אמיתית ל-API של אוריין (דורש credentials מלאים)
//
// ────────────────────────────────────────────────────────────────────────────
// 📌 הערה חשובה לעתיד - הדפסת מדבקות:
//
// במצב Mock, המערכת מייצרת מדבקות לוקלית (לטובת בדיקה ופיתוח).
//
// במצב Live, אוריין מייצרת את המדבקות **הרשמיות** וצריך למשוך אותן באמצעות:
//   POST /GetTransportationOrderLabel
//   - מחזיר PDF מקודד Base64 לכל מארז (לפי PACKAGEID)
//   - כל מארז עם ברקוד ייחודי משלו
//
// כשנעבור ל-live - יש להוסיף פונקציה:
//   export async function fetchTransportationOrderLabel(orianOrderId) {...}
// ולשנות את ה-Frontend (LabelPage / LabelsBatchPage) שיקרא אותה ויציג את ה-PDF
// במקום ה-mock label המקומי.
// ────────────────────────────────────────────────────────────────────────────

import { getToken } from './auth.js';
import orianClient from './client.js';
import { buildXml } from './xml.js';

function isMockMode() {
  return (process.env.ORIAN_MODE || 'mock').toLowerCase() === 'mock';
}

/**
 * יוצר מזהה מעקב סימולציה בסגנון של אוריין
 * (אוריין משתמשת ב-12 ספרות בדרך כלל)
 */
function generateMockOrianId() {
  // 12 ספרות אקראיות עם תחילית ייחודית של ה-mock
  const random = Math.floor(Math.random() * 1e10).toString().padStart(10, '0');
  return `99${random}`;
}

/**
 * יוצרת הזמנת משלוח אצל אוריין (או מדמה אותה).
 *
 * @param {object} args
 * @param {object} args.shipment - אובייקט המשלוח (עם reference_id, package_count, וכו')
 * @param {object} args.sourceBranch - פרטי הסניף השולח
 * @param {object} args.targetBranch - פרטי הסניף המקבל
 * @returns {Promise<{orian_order_id, source: 'mock'|'live'}>}
 */
export async function createTransportationOrder({ shipment, sourceBranch, targetBranch }) {
  if (isMockMode()) {
    return createMockOrder({ shipment, sourceBranch, targetBranch });
  }
  return createLiveOrder({ shipment, sourceBranch, targetBranch });
}

// ====================================================================
// MOCK - סימולציה לוקלית
// ====================================================================
async function createMockOrder({ shipment, sourceBranch, targetBranch }) {
  // הדפסה ל-console לטובת בדיקות
  console.log(
    `🎭 [Orian Mock] יצירת הזמנה: ${shipment.reference_id} מ-${sourceBranch.name} ל-${targetBranch.name} (${shipment.package_count} מארזים)`
  );

  // השהייה קטנה כדי לדמות זמן תגובה של רשת
  await new Promise((r) => setTimeout(r, 150));

  const orianOrderId = generateMockOrianId();
  console.log(`🎭 [Orian Mock] תגובה: orian_order_id = ${orianOrderId}`);

  return {
    orian_order_id: orianOrderId,
    source: 'mock',
  };
}

// ====================================================================
// LIVE - קריאה אמיתית לאוריין
// ====================================================================
async function createLiveOrder({ shipment, sourceBranch, targetBranch }) {
  const consignee = process.env.ORIAN_CONSIGNEE;
  if (!consignee) {
    throw new Error('חסר ORIAN_CONSIGNEE - לא ניתן לפעול במצב live');
  }

  const token = await getToken();

  // בניית מבנה ה-XML לפי מסמכי אוריין (CreateTransportationOrder)
  const payload = {
    DATACOLLECTION: {
      DATA: {
        TABLENAME: 'TRANSPORTATIONORDER',
        CONSIGNEE: consignee,
        ORDERTYPE: 'REGULAR',
        REFERENCEORDER: shipment.reference_id,
        TRANSPORTATIONTYPE: 'DOMESTIC',
        SERVICETYPE: 'NEXTDAY',
        PAYMENTTYPE: 'CREDIT',
        PACKAGETYPE: shipment.package_type,
        UNITS: shipment.package_count,
        NOTES: shipment.notes || '',
        SOURCECONTACT: {
          CONTACTTYPE: 'PICKUP',
          STREET1: sourceBranch.address || sourceBranch.name,
          CITY: sourceBranch.city,
          ZIP: sourceBranch.zip || '',
          ADDRESSTYPE: '02', // Business
          CONTACT1NAME: sourceBranch.contact_name || sourceBranch.name,
          CONTACT1PHONE: sourceBranch.contact_phone || '',
        },
        TARGETCONTACT: {
          CONTACTTYPE: 'DELIVERY',
          STREET1: targetBranch.address || targetBranch.name,
          CITY: targetBranch.city,
          ZIP: targetBranch.zip || '',
          ADDRESSTYPE: '02',
          CONTACT1NAME: targetBranch.contact_name || targetBranch.name,
          CONTACT1PHONE: targetBranch.contact_phone || '',
        },
        PACKAGES: {
          PACKAGE: {
            PACKAGEID: shipment.reference_id,
            PACKAGETYPE: shipment.package_type,
            DOCUMENTTYPE: 'TRANSPORTATION',
          },
        },
      },
    },
  };

  const xml = buildXml(payload);
  const response = await orianClient.post('/CreateTransportationOrder', xml, {
    headers: {
      AuthToken: token,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  // אוריין מחזירה XML עם הצלחה/כישלון. כרגע אנחנו מסתפקים ב-status code.
  // ה-orian_order_id מתקבל בדרך כלל בקריאה נפרדת או ב-response.
  // לעת עתה נשתמש ב-reference_id כקישור.
  return {
    orian_order_id: shipment.reference_id,
    source: 'live',
  };
}
