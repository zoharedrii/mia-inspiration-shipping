// רכיב מדבקת משלוח - מציג מדבקה אחת בסגנון אוריין
//
// משמש גם בעמוד מדבקה בודדת וגם בעמוד הדפסה מרובה.

import { QRCodeSVG } from 'qrcode.react';
import { PACKAGE_TYPES } from '../api/shipments.js';
import Barcode from './Barcode.jsx';

const PACKAGE_TYPE_MAP = Object.fromEntries(PACKAGE_TYPES.map((p) => [p.value, p.label]));

function formatDateShort(isoString) {
  if (!isoString) return '—';
  const date = new Date(isoString.replace(' ', 'T') + 'Z');
  return date.toLocaleDateString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * מדבקת משלוח יחידה.
 *
 * @param {object} props.shipment      - אובייקט המשלוח
 * @param {number} [props.packageIndex] - איזה מארז מתוך הסה"כ (1, 2, 3...)
 * @param {number} [props.totalPackages] - סך כל המארזים במשלוח (אם לא צוין, נלקח מ-shipment.package_count)
 */
export default function ShippingLabel({ shipment, packageIndex = 1, totalPackages }) {
  if (!shipment) return null;

  const total = totalPackages || shipment.package_count || 1;

  // ערך הברקוד הבסיסי (מזהה אוריין אם יש, אחרת reference_id)
  const baseId = shipment.orian_order_id || shipment.reference_id;
  // לכל מארז במשלוח - ברקוד ייחודי משלו
  const barcodeValue = total > 1 ? `${baseId}-${packageIndex}` : baseId;

  return (
    <div className="bg-white border-2 border-black mx-auto" dir="rtl" style={{ maxWidth: '640px' }}>
      {/* ===== כותרת עליונה ===== */}
      <div className="grid grid-cols-2 border-b-2 border-black">
        <div className="p-3 flex items-center justify-center border-l-2 border-black">
          <OrianLogo />
        </div>
        <div className="p-3 text-sm font-bold space-y-0.5 text-right">
          <div>סניף: צפון - 03</div>
          <div>מ.מיון: מרלו"ג צ - 506</div>
          <div className="text-base">{formatDateShort(shipment.created_at)}</div>
        </div>
      </div>

      {/* ===== ברקוד + QR ===== */}
      <div className="grid grid-cols-[1fr_140px] border-b-2 border-black">
        <div className="p-3 border-l-2 border-black">
          <div className="text-xs text-right mb-1">
            <span className="font-bold">{packageIndex} מתוך {total}</span>
            <span className="mr-3">אסמכתא:</span>
          </div>
          <div className="px-2">
            <Barcode value={barcodeValue} height={70} width={2} />
          </div>
          <div className="text-center text-xl font-bold tracking-wider mt-1">
            {barcodeValue}
          </div>
        </div>
        <div className="p-3 flex items-center justify-center">
          <QRCodeSVG value={barcodeValue} size={120} level="M" />
        </div>
      </div>

      {/* ===== שולח + נמען ===== */}
      <div className="grid grid-cols-2 border-b-2 border-black">
        {/* שמאל: נמען */}
        <div className="p-3 border-l-2 border-black text-right text-sm">
          <div className="font-bold underline mb-2">נמען:</div>
          <div className="font-bold text-base mb-2">
            {shipment.target_branch_number ? `${shipment.target_branch_number} ` : ''}
            {shipment.target_branch_name}
          </div>
          <div className="text-xs space-y-0.5">
            {shipment.target_branch_address && <div>{shipment.target_branch_address}</div>}
            {shipment.target_branch_city && <div>{shipment.target_branch_city}</div>}
            {shipment.target_contact_name && (
              <div className="pt-1">
                <span className="font-bold">איש קשר: </span>
                {shipment.target_contact_name}
              </div>
            )}
            {shipment.target_contact_phone && (
              <div>
                <span className="font-bold">טלפון: </span>
                <span dir="ltr">{shipment.target_contact_phone}</span>
              </div>
            )}
          </div>
        </div>

        {/* ימין: שולח */}
        <div className="p-3 text-right text-sm">
          <div className="font-bold underline mb-2">שולח:</div>
          <div className="font-bold text-base mb-2">{shipment.source_branch_name}</div>
          <div className="text-xs space-y-0.5">
            {shipment.source_branch_address && <div>{shipment.source_branch_address}</div>}
            {shipment.source_branch_city && <div>{shipment.source_branch_city}</div>}
            {shipment.source_contact_name && (
              <div className="pt-1">
                <span className="font-bold">איש קשר: </span>
                {shipment.source_contact_name}
              </div>
            )}
            {shipment.source_contact_phone && (
              <div>
                <span className="font-bold">טלפון: </span>
                <span dir="ltr">{shipment.source_contact_phone}</span>
              </div>
            )}
            {shipment.orian_order_id && (
              <div className="pt-1">
                <span className="font-bold">מס' הזמנה אוריין: </span>
                <span dir="ltr">{shipment.orian_order_id}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== שירותים + הערות ===== */}
      <div className="grid grid-cols-[1fr_140px]">
        <div className="p-3 border-l-2 border-black">
          <div className="font-bold underline text-sm mb-1">הערות לבלדר:</div>
          <div className="text-xs min-h-12">{shipment.notes || ''}</div>
        </div>
        <div className="p-3 text-right text-xs">
          <div className="font-bold underline text-sm mb-1">שירותים מיוחדים:</div>
          <div className="min-h-6"></div>
          <div className="mt-2">
            <span className="font-bold">סוג חבילה: </span>
            {PACKAGE_TYPE_MAP[shipment.package_type] || shipment.package_type}
          </div>
          <div className="mt-1">
            <span className="font-bold">כמות: </span>
            {shipment.package_count} מארזים
          </div>
        </div>
      </div>
    </div>
  );
}

function OrianLogo() {
  return (
    <div dir="ltr" className="text-center">
      <div className="text-3xl font-black tracking-wider text-black">ORIAN</div>
      <div className="h-1 bg-red-600 mt-0.5"></div>
    </div>
  );
}
