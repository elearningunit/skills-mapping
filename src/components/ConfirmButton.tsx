import { useEffect, useState, type ReactNode } from 'react';

/** כפתור שדורש לחיצה שנייה לאישור (במקום חלון confirm) */
export function ConfirmButton({ children, confirmLabel, onConfirm, className }: {
  children: ReactNode; confirmLabel: string; onConfirm: () => void; className?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 5000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      className={`${className ?? ''} ${armed ? 'armed' : ''}`}
      onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}
      onBlur={() => setArmed(false)}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}
