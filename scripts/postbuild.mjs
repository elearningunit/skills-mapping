// מנקה תווי בקרה גולמיים (בתוך מחרוזות JS של ספריות) ומחליף אותם ב-\\xNN, כדי שהדף יכיל טקסט נקי בלבד.
import { readFileSync, writeFileSync } from 'node:fs';
const file = process.argv[2];
let html = readFileSync(file, 'utf8');
const CTRL = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g;
const n = (html.match(CTRL) || []).length;
html = html.replace(CTRL, (c) => '\\x' + c.charCodeAt(0).toString(16).padStart(2, '0'));
writeFileSync(file, html);
console.log(`${file}: ${(Buffer.byteLength(html) / 1024).toFixed(0)}KB${n ? `, escaped ${n} control character(s)` : ''}`);
