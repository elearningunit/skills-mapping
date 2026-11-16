// גופן Rubik נארז עם היישום (data URI) — אין קריאות רשת בזמן ריצה.
import he400 from '@fontsource/rubik/files/rubik-hebrew-400-normal.woff2';
import he500 from '@fontsource/rubik/files/rubik-hebrew-500-normal.woff2';
import he700 from '@fontsource/rubik/files/rubik-hebrew-700-normal.woff2';
import la400 from '@fontsource/rubik/files/rubik-latin-400-normal.woff2';
import la500 from '@fontsource/rubik/files/rubik-latin-500-normal.woff2';
import la700 from '@fontsource/rubik/files/rubik-latin-700-normal.woff2';

const HE = 'U+0307-0308, U+0590-05FF, U+200C-2010, U+20AA, U+25CC, U+FB1D-FB4F';
const LA = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';

const face = (src: string, weight: number, range: string) =>
  `@font-face{font-family:'Rubik';font-style:normal;font-display:swap;font-weight:${weight};src:url(${src}) format('woff2');unicode-range:${range};}`;

export const FONT_CSS = [
  face(he400, 400, HE), face(he500, 500, HE), face(he700, 700, HE),
  face(la400, 400, LA), face(la500, 500, LA), face(la700, 700, LA),
].join('\n');

export function installFonts() {
  const el = document.createElement('style');
  el.textContent = FONT_CSS;
  document.head.appendChild(el);
}
