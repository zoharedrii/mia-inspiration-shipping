// StatusBadge - תווית קטנה צבעונית לסטטוס משלוח
//
// שימוש: <StatusBadge status="sent" />
// מציג: "נשלח" ברקע כחול, "התקבל" בירוק, וכו'.

import { STATUS_LABELS, STATUS_CLASSES } from '../api/shipments.js';

export default function StatusBadge({ status }) {
  const label = STATUS_LABELS[status] || status;
  const className = STATUS_CLASSES[status] || 'bg-gray-200 text-gray-800';

  return (
    <span
      className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}
