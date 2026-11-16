// מפת צבעים בעלת משמעות: אדום = נמוך (שלילי), ירוק = גבוה (חיובי). כל צבע מלווה גם בתווית טקסט.
export type Level = 0 | 1 | 2 | 3 | 4;

export const LEVEL_LABELS: Record<Level, string> = {
  0: 'נמוך מאוד',
  1: 'נמוך',
  2: 'בינוני',
  3: 'גבוה',
  4: 'גבוה מאוד',
};

export const LEVEL_RANGES: Record<Level, string> = {
  0: '0–0.99',
  1: '1–1.99',
  2: '2–2.99',
  3: '3–3.49',
  4: '3.5–4',
};

/** ממיר ציון 0–4 (שלם או ממוצע) לרמת צבע. לציונים שלמים: 0→0 … 4→4. */
export function levelOf(v: number): Level {
  if (v < 1) return 0;
  if (v < 2) return 1;
  if (v < 3) return 2;
  if (v < 3.5) return 3;
  return 4;
}
