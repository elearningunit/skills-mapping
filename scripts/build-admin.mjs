// מכין את קובץ המסך של ממשק הרשות להתקנה ב-Apps Script:
// dist-admin/admin.html  ->  admin/apps-script/index.html
// HtmlService מגיש את הקובץ כמו שהוא; כדי לא להסתמך על תמיכה בסקריפטים מסוג module, הסקריפט הופך לסקריפט רגיל
// בסוף הגוף (אחרי <div id="root">), ותווי בקרה גולמיים נכתבים כ-\xNN.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const [input = 'dist-admin/admin.html', output = 'admin/apps-script/index.html'] = process.argv.slice(2);
let html = readFileSync(input, 'utf8');
html = html.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, (c) => '\\x' + c.charCodeAt(0).toString(16).padStart(2, '0'));

const open = html.indexOf('<script type="module" crossorigin>');
if (open < 0) throw new Error('inline module script not found');
const start = open + '<script type="module" crossorigin>'.length;
const end = html.indexOf('</script>', start);
const code = html.slice(start, end);
if (/\bimport\s*\(|^\s*import\s|^\s*export\s|import\.meta/m.test(code)) throw new Error('bundle still uses module syntax');
html = html.slice(0, open) + html.slice(end + '</script>'.length);
const bodyEnd = html.lastIndexOf('</body>');
html = html.slice(0, bodyEnd) + `<script>(function(){"use strict";\n${code}\n})();</script>\n` + html.slice(bodyEnd);

mkdirSync(output.replace(/\/[^/]+$/, ''), { recursive: true });
writeFileSync(output, html);
console.log(`${output}: ${(Buffer.byteLength(html) / 1024).toFixed(0)}KB`);
