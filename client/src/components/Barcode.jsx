// רכיב ברקוד CODE128 בסגנון של אוריין
//
// משתמש ב-jsbarcode על אלמנט SVG.

import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

export default function Barcode({ value, height = 70, width = 2, displayValue = false }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, {
          format: 'CODE128',
          height,
          width,
          displayValue,
          margin: 0,
          background: '#ffffff',
          lineColor: '#000000',
        });
      } catch (err) {
        console.error('Barcode generation failed:', err);
      }
    }
  }, [value, height, width, displayValue]);

  return <svg ref={svgRef} className="w-full" />;
}
