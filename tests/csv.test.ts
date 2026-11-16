import { describe, expect, it } from 'vitest';
import { parseCsv } from '../src/lib/csvParse.mjs';
import { CSV_COLUMNS, buildCsv, escapeCsv, guardFormula } from '../src/lib/csv';
import { fill, mapping } from './helpers';

const EXPECTED = 'assessment_id,faculty,department,study_year,lecturer_name,course_name,assessment_date,questionnaire_version,T1,T2,T3,T4,T5,C1,C2,C3,C4,C5,R1,R2,R3,R4,R5,T_P,T_A,C_P,C_A,R_P,R_A,H1,H2,H3,H4,H5,H_P,H_A,T_status,C_status,R_status,H_status,academic_year';

describe('ייצוא CSV', () => {
  it('41 עמודות: 29 של גרסה 0.4 במקומן; H, סטטוס ושנה אקדמית בסוף; BOM, כותרת ושורה אחת', () => {
    const csv = buildCsv(mapping(fill(2, { T1: 3, R5: 0, H1: 4, H5: 1 })));
    expect(CSV_COLUMNS).toHaveLength(41);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const rows = parseCsv(csv).filter((r) => r.length > 1);
    expect(rows).toHaveLength(2);
    expect(rows[0].join(',')).toBe(EXPECTED);
    expect(rows[1]).toHaveLength(41);
  });

  it('ערכים: עברית נשמרת, תאריך ISO, גרסה, שנה כמספר, ממוצעים בשתי ספרות', () => {
    const rows = parseCsv(buildCsv(mapping(fill(2, { T1: 3, R5: 0 }))));
    const rec = Object.fromEntries(rows[0].map((h, i) => [h, rows[1][i]]));
    expect(rec.faculty).toBe('הפקולטה למדעי הבריאות');
    expect(rec.department).toBe('ריפוי בעיסוק');
    expect(rec.lecturer_name).toBe('ד"ר ישראלה ישראלי');
    expect(rec.assessment_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(rec.study_year).toBe('2');
    expect(rec.academic_year).toBe('תשפ״ז');
    expect(rec.T1).toBe('3');
    expect(rec.R5).toBe('0');
    expect(rec.T_P).toBe('2.25');
    expect(rec.T_A).toBe('2.00');
    expect(rec.R_A).toBe('0.00');
    expect(rec.questionnaire_version).toBe('0.5');
    expect(rec.H1).toBe('2');
    expect(rec.H_P).toBe('2.00');
  });

  it('בריחת פסיקים, מרכאות ושורות חדשות לפי RFC 4180', () => {
    expect(escapeCsv('a,b')).toBe('"a,b"');
    expect(escapeCsv('ביה"ס')).toBe('"ביה""ס"');
    expect(escapeCsv('x\ny')).toBe('"x\ny"');
    const csv = buildCsv(mapping(fill(1), { course_name: 'סמינר, "מתקדם"', department: 'ביה"ס לרפואה', faculty: 'בית הספר לרפואה' }));
    const rows = parseCsv(csv);
    expect(rows[1][5]).toBe('סמינר, "מתקדם"');
    expect(rows[1][2]).toBe('ביה"ס לרפואה');
  });

  it('הגנה מפני formula injection בשדות טקסט חופשיים', () => {
    expect(guardFormula('=HYPERLINK("x")')).toBe(`'=HYPERLINK("x")`);
    expect(guardFormula('+972')).toBe(`'+972`);
    expect(guardFormula('מבוא')).toBe('מבוא');
    const rows = parseCsv(buildCsv(mapping(fill(0), { lecturer_name: '@cmd' })));
    expect(rows[1][4]).toBe(`'@cmd`);
  });

  it('תרחישי קצה: הכול 0 והכול 4', () => {
    const rec = (a: ReturnType<typeof fill>) => {
      const [h, r] = parseCsv(buildCsv(mapping(a)));
      return Object.fromEntries(h.map((k, i) => [k, r[i]]));
    };
    const r0 = rec(fill(0));
    const r4 = rec(fill(4));
    for (const k of ['T', 'C', 'R', 'H']) {
      for (let n = 1; n <= 5; n++) { expect(r0[k + n]).toBe('0'); expect(r4[k + n]).toBe('4'); }
      expect([r0[k + '_P'], r0[k + '_A']]).toEqual(['0.00', '0.00']);
      expect([r4[k + '_P'], r4[k + '_A']]).toEqual(['4.00', '4.00']);
    }
  });
});
