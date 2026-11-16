// מעדכן את רשימת הפקולטות והמחלקות בקולט (collector/Code.gs) מתוך src/config/faculties_departments.json,
// כדי שלאתר ולקולט יהיה מקור אמת אחד. בדיקה אוטומטית נכשלת אם השניים אינם זהים.
import { readFileSync, writeFileSync } from 'node:fs';

const pairs = JSON.parse(readFileSync('src/config/faculties_departments.json', 'utf8'));
const units = {};
for (const { faculty, department } of pairs) (units[faculty] ||= []).push(department);
const body = Object.entries(units)
  .map(([f, ds]) => `  ${JSON.stringify(f)}: [${ds.map((d) => JSON.stringify(d)).join(', ')}]`)
  .join(',\n');

const file = 'collector/Code.gs';
const src = readFileSync(file, 'utf8');
const re = /(\/\/ <units>[^\n]*\n)var UNITS = \{[\s\S]*?\};\n(\/\/ <\/units>)/;
if (!re.test(src)) throw new Error('units block not found in ' + file);
const out = src.replace(re, `$1var UNITS = {\n${body}\n};\n$2`);
writeFileSync(file, out);
console.log(out === src ? 'collector units already in sync' : 'collector units updated');
