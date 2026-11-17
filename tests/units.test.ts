import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCsv } from '../src/lib/csvParse.mjs';
import { FACULTIES, UNIT_PAIRS, departmentsOf } from '../src/config/units';

describe('רשימת הפקולטות והמחלקות', () => {
  const raw = readFileSync(new URL('../data/faculties_departments.csv', import.meta.url), 'utf8');
  const rows = parseCsv(raw).filter((r) => r.some((c) => c.trim()));
  const body = rows.slice(1);

  it('קובץ המקור: UTF-8 עם BOM, 41 שורות, ללא תאים ריקים', () => {
    expect(raw.charCodeAt(0)).toBe(0xfeff);
    expect(rows[0]).toEqual(['פקולטה', 'מחלקה / בית ספר']);
    expect(body).toHaveLength(41);
    body.forEach((r) => { expect(r).toHaveLength(2); r.forEach((c) => expect(c.trim()).not.toBe('')); });
  });

  it('ה-JSON בבנייה זהה לקובץ המקור (41 זוגות, 9 פקולטות)', () => {
    expect(UNIT_PAIRS.map((p) => [p.faculty, p.department])).toEqual(body);
    expect(new Set(UNIT_PAIRS.map((p) => p.faculty + '|' + p.department)).size).toBe(41);
    expect(FACULTIES).toHaveLength(9);
  });

  it('שמות עם מרכאות נשמרים כמות שהם', () => {
    expect(departmentsOf('בית הספר לרפואה')).toEqual(['ביה"ס לרפואה']);
    expect(departmentsOf('הפקולטה למדעי החברה והרוח')).toContain('ביה"ס לעבודה סוציאלית');
  });

  it('כל מחלקה שייכת לפקולטה אחת בלבד ברשימה התלויה', () => {
    const total = FACULTIES.reduce((n, f) => n + departmentsOf(f).length, 0);
    expect(total).toBe(41);
    expect(departmentsOf('הפקולטה להנדסה')).toHaveLength(7);
  });
});
