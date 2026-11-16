// Generates src/config/faculties_departments.json from data/faculties_departments.csv
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseCsv } from '../src/lib/csvParse.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const text = readFileSync(join(root, 'data/faculties_departments.csv'), 'utf8');
const rows = parseCsv(text).filter((r) => r.some((c) => c.trim() !== ''));
const [, ...body] = rows;
const pairs = body.map(([faculty, department]) => ({ faculty, department }));
writeFileSync(join(root, 'src/config/faculties_departments.json'), JSON.stringify(pairs, null, 2) + '\n');
console.log(`wrote ${pairs.length} pairs, ${new Set(pairs.map((p) => p.faculty)).size} faculties`);
