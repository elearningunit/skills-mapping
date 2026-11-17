// יוצר את src/config/courses.json (רשימת הקורסים והמרצים לבחירה בממשק המרצה) מתוך data/courses.csv.
// עמודות הקובץ (שורת כותרת בעברית): מחלקה, מספר קורס, שם קורס, שם מרצה, ואופציונלית: שנה (1–5 או א׳–ה׳), שם משפחה (למיון המרצים).
// שימוש: node scripts/gen-courses.mjs [input.csv] [output.json]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseCsv } from '../src/lib/csvParse.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [input = join(root, 'data/courses.csv'), output = join(root, 'src/config/courses.json')] = process.argv.slice(2);
const units = JSON.parse(readFileSync(join(root, 'src/config/faculties_departments.json'), 'utf8'));
const known = new Set(units.map((u) => u.department));

if (!existsSync(input)) {
  writeFileSync(output, '{}\n');
  console.log('no data/courses.csv — wrote an empty catalog (lecturers type course and name manually)');
  process.exit(0);
}

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const rows = parseCsv(readFileSync(input, 'utf8').replace(/^﻿/, '')).filter((r) => r.some((c) => clean(c)));
const [head, ...body] = rows;
const col = (re, required = true) => {
  const i = head.findIndex((h) => re.test(clean(h)));
  if (i < 0 && required) throw new Error(`missing column ${re} in ${input}`);
  return i;
};
const cDept = col(/^מחלקה$/), cNum = col(/מספר/), cName = col(/שם (קורס|שעור|שיעור)/), cLec = col(/^שם מרצה$/), cYear = col(/^שנה/, false), cLast = col(/^שם משפחה$/, false);
const HEB = { 'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5 };
const year = (s) => {
  const v = clean(s).replace(/[׳'"״]/g, '');
  const n = /^[1-5]$/.test(v) ? Number(v) : HEB[v] ?? null;
  return n;
};

const out = {};
const unknown = new Map();
let n = 0;
const sortKey = new Map(); // שם מרצה -> מפתח מיון (שם משפחה, אם יש)
for (const r of body) {
  const d = clean(r[cDept]), num = clean(r[cNum]), name = clean(r[cName]), lec = clean(r[cLec]);
  if (!d || !name) continue;
  if (!known.has(d)) { unknown.set(d, (unknown.get(d) ?? 0) + 1); continue; }
  const dept = (out[d] ??= { courses: [], lecturers: {} });
  const y = cYear >= 0 ? year(r[cYear]) : null;
  let idx = dept.courses.findIndex((c) => c[0] === num && c[1] === name);
  if (idx < 0) { idx = dept.courses.push([num, name, y]) - 1; } else if (dept.courses[idx][2] === null && y) dept.courses[idx][2] = y;
  if (lec) {
    if (cLast >= 0 && clean(r[cLast]) && !sortKey.has(lec)) sortKey.set(lec, `${clean(r[cLast])} ${lec}`);
    const list = (dept.lecturers[lec] ??= []);
    if (!list.includes(idx)) list.push(idx);
  }
  n++;
}
// מבנה סופי: קורסים ממוינים לפי שם; מרצים ממוינים לפי שם, עם אינדקסים לקורסים
const final = {};
for (const d of Object.keys(out).sort((a, b) => a.localeCompare(b, 'he'))) {
  const { courses, lecturers } = out[d];
  const order = courses.map((_, i) => i).sort((a, b) => courses[a][1].localeCompare(courses[b][1], 'he') || courses[a][0].localeCompare(courses[b][0]));
  const remap = new Map(order.map((oldI, newI) => [oldI, newI]));
  final[d] = {
    courses: order.map((i) => courses[i]),
    lecturers: Object.keys(lecturers).sort((a, b) => (sortKey.get(a) ?? a).localeCompare(sortKey.get(b) ?? b, 'he'))
      .map((l) => [l, lecturers[l].map((i) => remap.get(i)).sort((a, b) => a - b)]),
  };
}
writeFileSync(output, JSON.stringify(final) + '\n');
const depts = Object.keys(final);
console.log(`wrote ${output}: ${n} rows, ${depts.length} departments, ${depts.reduce((s, d) => s + final[d].courses.length, 0)} courses, ${depts.reduce((s, d) => s + final[d].lecturers.length, 0)} lecturers`);
if (unknown.size) {
  console.log('departments not in faculties_departments.csv (skipped):');
  for (const [d, c] of unknown) console.log(`  ${d} (${c} rows)`);
}
