import { describe, expect, it } from 'vitest';
import { toRecord } from '../src/admin/model';
import { EMPTY_FILTERS } from '../src/admin/model';
import { aggregate, byStudyYear, chunk, programObservations, reportFilename, reportRows, reportScope, toScoreMap } from '../src/admin/report';

type S = number[] | null; // null = לא רלוונטי
function rec(id: string, o: { year?: number; course?: string; lecturer?: string; T?: S; C?: S; R?: S; H?: S }) {
  const r: Record<string, unknown> = {
    assessment_id: id, created_at: '2026-11-16T08:00:00.000Z', faculty: 'הפקולטה למדעי הבריאות', department: 'סיעוד',
    study_year: o.year ?? 1, academic_year: 'תשפ״ז', lecturer_name: o.lecturer ?? `מרצה ${id}`, course_name: o.course ?? `קורס ${id}`,
    status: 'valid', flags: '', decision: '',
  };
  for (const k of ['T', 'C', 'R', 'H'] as const) {
    const a = o[k] === undefined ? [2, 2, 2, 2, 2] : o[k];
    a?.forEach((v, i) => { r[`${k}${i + 1}`] = v; });
    r[`${k}_P`] = a ? (a[0] + a[1] + a[2] + a[3]) / 4 : '';
    r[`${k}_A`] = a ? a[4] : '';
    r[`${k}_status`] = a ? 'answered' : 'not_applicable';
  }
  return toRecord(r);
}

describe('דוח PDF – חישובים', () => {
  it('ממוצעים לפי מיומנות, ללא קורסים שסימנו "לא רלוונטי"', () => {
    const a = aggregate([rec('a', { T: [4, 4, 4, 4, 2], R: null }), rec('b', { T: [2, 2, 2, 2, 0], R: [1, 1, 1, 1, 1] })]);
    const T = a.find((x) => x.key === 'T')!;
    const R = a.find((x) => x.key === 'R')!;
    expect([T.n, T.na, T.practice, T.assessment]).toEqual([2, 0, 3, 1]);
    expect([R.n, R.na, R.practice, R.assessment]).toEqual([1, 1, 1, 1]);
  });

  it('מיומנות שכל הקורסים סימנו כלא רלוונטית אינה מקבלת ציון בתרשים', () => {
    const m = toScoreMap(aggregate([rec('a', { H: null })]));
    expect(m.H).toBeUndefined();
    expect(m.T?.practice).toBe(2);
  });

  it('פילוח לפי שנה בתואר, רק לשנים שיש בהן דיווחים', () => {
    const ys = byStudyYear([rec('a', { year: 1 }), rec('b', { year: 3 }), rec('c', { year: 3 })]);
    expect(ys.map((y) => [y.label, y.n])).toEqual([['שנה א׳', 1], ['שנה ג׳', 2]]);
  });

  it('נקודות לתשומת לב: פער תרגול/הערכה, מיומנות חסרה, "לא רלוונטי" ברוב הקורסים, קורס יחיד', () => {
    const recs = [
      rec('a', { course: 'מבוא', T: [4, 4, 4, 4, 1], C: [0, 1, 0, 1, 0], R: null, H: [4, 4, 4, 4, 3] }),
      rec('b', { T: [3, 3, 3, 3, 1], C: [1, 0, 1, 0, 1], R: null, H: [1, 1, 1, 1, 2] }),
      rec('c', { T: [3, 3, 3, 3, 2], C: [1, 1, 1, 1, 0], R: [2, 2, 2, 2, 2], H: [2, 2, 2, 2, 2] }),
    ];
    const ids = programObservations(recs).map((o) => o.id);
    expect(ids).toEqual(['na_R', 'absent_C', 'unassessed_T', 'single_H']);
    const single = programObservations(recs).find((o) => o.id === 'single_H')!;
    expect(single.text).toContain('"מבוא"');
  });

  it('ללא פערים: נקודה אחת שמסבירה זאת; ללא דיווחים: אין נקודות', () => {
    expect(programObservations([rec('a', {}), rec('b', {})]).map((o) => o.id)).toEqual(['balanced']);
    expect(programObservations([])).toEqual([]);
  });

  it('כותרת לפי הסינון: מחלקה / פקולטה / מרצה יחיד / כלל האוניברסיטה', () => {
    const rs = [rec('a', { lecturer: 'ד"ר נועה לוי' }), rec('b', { lecturer: 'נועה לוי' })];
    expect(reportScope({ ...EMPTY_FILTERS, department: 'סיעוד', academicYear: 'תשפ״ז' }, rs))
      .toEqual({ title: 'מחלקת סיעוד', scope: ['שנה אקדמית תשפ״ז'] });
    expect(reportScope({ ...EMPTY_FILTERS, faculty: 'הפקולטה להנדסה' }, rs).title).toBe('הפקולטה להנדסה');
    expect(reportScope({ ...EMPTY_FILTERS, q: 'נועה', department: 'סיעוד' }, rs).title).toBe('ד"ר נועה לוי');
    expect(reportScope({ ...EMPTY_FILTERS, q: 'נועה', department: 'סיעוד' }, rs).scope[0]).toBe('מחלקת סיעוד');
    expect(reportScope(EMPTY_FILTERS, rs).title).toBe('כלל האוניברסיטה');
  });

  it('מיון לפי שנה ואז שם קורס; חלוקה לעמודים; שם קובץ לטיני', () => {
    const rs = reportRows([rec('a', { year: 2, course: 'ב' }), rec('b', { year: 1, course: 'ת' }), rec('c', { year: 1, course: 'א' })]);
    expect(rs.map((r) => r.id)).toEqual(['c', 'b', 'a']);
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 2)).toEqual([[]]);
    expect(reportFilename(new Date(2026, 10, 17, 9, 5))).toBe('skills_report_2026-11-17_0905.pdf');
  });
});
