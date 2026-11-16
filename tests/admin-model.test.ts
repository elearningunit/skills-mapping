import { describe, expect, it } from 'vitest';
import {
  actionsFor, applyFilters, counts, EMPTY_FILTERS, flagLabel, normalize, sortNewestFirst, toRecord, type AdminRecord,
} from '../src/admin/model';

const base: Record<string, unknown> = {
  assessment_id: 'a', received_at: '2026-11-16T08:00:00.000Z', created_at: '2026-11-16T08:00:00.000Z',
  faculty: 'הפקולטה למדעי הבריאות', department: 'סיעוד', study_year: 1, academic_year: 'תשפ״ז',
  lecturer_name: 'ד"ר נועה לוי', course_name: 'יסודות הסיעוד', assessment_date: '2026-11-16', questionnaire_version: '0.5',
  T1: 3, T2: 3, T3: 3, T4: 3, T5: 1, T_P: 3, T_A: 1, T_status: 'answered',
  C1: 2, C2: 2, C3: 2, C4: 2, C5: 0, C_P: 2, C_A: 0, C_status: 'answered',
  R1: '', R2: '', R3: '', R4: '', R5: '', R_P: '', R_A: '', R_status: 'not_applicable',
  H1: 4, H2: 4, H3: 4, H4: 4, H5: 4, H_P: 4, H_A: 4, H_status: 'answered',
  submissions: 2, status: 'valid', flags: '', decision: '',
};
const rec = (over: Record<string, unknown> = {}) => toRecord({ ...base, ...over });

describe('ממשק הרשות – מודל', () => {
  it('שורת גיליון הופכת לרשומה: ציונים, "לא רלוונטי" ו-20 תשובות', () => {
    const r = rec();
    expect(r.skills.map((s) => [s.key, s.notApplicable, s.practice, s.assessment])).toEqual([
      ['T', false, 3, 1], ['C', false, 2, 0], ['R', true, null, null], ['H', false, 4, 4],
    ]);
    expect(Object.keys(r.answers)).toHaveLength(20);
    expect([r.answers.T5, r.answers.R1]).toEqual([1, null]);
    expect([r.submissions, r.studyYear, r.status]).toEqual([2, 1, 'valid']);
  });

  it('שורה שלא עברה הסבה מוצגת "לבדיקה" ואינה נספרת', () => {
    const r = rec({ status: '', flags: '' });
    expect(r.status).toBe('flagged');
    expect(r.flags).toEqual(['not_migrated']);
  });

  it('תאריך מיפוי שהגיליון המיר לתאריך מוצג כתאריך מקומי', () => {
    const d = new Date('2026-11-12T00:00:00'); // חצות מקומית
    expect(rec({ assessment_date: d.toISOString() }).assessmentDate).toBe('2026-11-12');
  });

  it('הסברים בעברית לסימונים', () => {
    expect(flagLabel('possible_duplicate:xyz')).toBe('כפילות אפשרית');
    expect(flagLabel('unknown_unit')).toContain('אינן תואמות');
    expect(flagLabel('score_mismatch_C')).toContain('חשיבה ביקורתית');
    expect(flagLabel('invalid_T3')).toBe('ערך לא תקין בהיגד T3');
    expect(flagLabel('invalid_study_year')).toBe('ערך לא תקין: שנה בתואר');
    expect(flagLabel('missing_academic_year')).toBe('חסרה שנה אקדמית');
  });

  it('פעולות לפי מצב: כפילות / סימון אחר / תקין / מוחרג', () => {
    const labels = (r: AdminRecord) => actionsFor(r).map((a) => a.action);
    expect(labels(rec({ status: 'flagged', flags: 'possible_duplicate:b' }))).toEqual(['replace_previous', 'include', 'exclude']);
    expect(labels(rec({ status: 'flagged', flags: 'unknown_unit' }))).toEqual(['include', 'exclude']);
    expect(labels(rec())).toEqual(['exclude']);
    expect(labels(rec({ decision: 'included' }))).toEqual(['reset', 'exclude']);
    expect(labels(rec({ status: 'excluded', decision: 'excluded' }))).toEqual(['reset']);
  });

  it('סינון לפי פקולטה, מחלקה, שנים וסטטוס; חיפוש מתעלם מתארים ומירכאות', () => {
    const rows = [
      rec(),
      rec({ assessment_id: 'b', department: 'פיזיותרפיה', study_year: 2, lecturer_name: 'פרופ׳ אבי כהן', course_name: 'אנטומיה' }),
      rec({ assessment_id: 'c', academic_year: 'תשפ״ו', status: 'flagged', flags: 'unknown_unit' }),
    ];
    const ids = (f: Partial<typeof EMPTY_FILTERS>) => applyFilters(rows, { ...EMPTY_FILTERS, ...f }).map((r) => r.id);
    expect(ids({})).toEqual(['a', 'b', 'c']);
    expect(ids({ department: 'פיזיותרפיה' })).toEqual(['b']);
    expect(ids({ studyYear: '1' })).toEqual(['a', 'c']);
    expect(ids({ academicYear: 'תשפ״ו' })).toEqual(['c']);
    expect(ids({ status: 'flagged' })).toEqual(['c']);
    expect(ids({ q: 'נועה לוי' })).toEqual(['a', 'c']);
    expect(ids({ q: 'ד״ר נועה' })).toEqual(['a', 'c']);
    expect(ids({ q: 'אבי' })).toEqual(['b']);
    expect(ids({ q: 'אנטומיה', department: 'סיעוד' })).toEqual([]);
    expect(normalize('  פרופ׳  אבי "כהן" ')).toBe('אבי כהן');
  });

  it('מונים ומיון מהחדש לישן', () => {
    const rows = [
      rec({ assessment_id: 'old', created_at: '2026-11-01T08:00:00.000Z' }),
      rec({ assessment_id: 'new', created_at: '2026-11-20T08:00:00.000Z', status: 'flagged', flags: 'unknown_unit' }),
      rec({ assessment_id: 'x', status: 'excluded' }),
    ];
    expect(counts(rows)).toEqual({ total: 3, valid: 1, flagged: 1, excluded: 1 });
    expect(sortNewestFirst(rows).map((r) => r.id)).toEqual(['new', 'x', 'old']);
  });
});
