import { describe, expect, it } from 'vitest';
import { buildInsights, joinHe, MAX_INSIGHTS } from '../src/lib/insights';
import { fill } from './helpers';

const ids = (a: Parameters<typeof buildInsights>[0]) => buildInsights(a).map((i) => i.id);

describe('מחולל התובנות', () => {
  it('הכול 4 → תובנת חוזק אחת לכל המיומנויות', () => {
    const r = buildInsights(fill(4));
    expect(r.map((i) => i.id)).toEqual(['aligned_strength']);
    expect(r[0].title).toContain('כל המיומנויות');
  });
  it('הכול 0 → המיומנויות אינן חלק מהקורס', () => {
    expect(ids(fill(0))).toEqual(['absent']);
  });
  it('הערכה גבוהה מתרגול מזוהה ומקבלת עדיפות עליונה', () => {
    const r = buildInsights(fill(2, { C1: 0, C2: 1, C3: 0, C4: 1, C5: 4 }));
    expect(r[0]).toMatchObject({ id: 'assessed_not_practiced', skills: ['C'] });
  });
  it('תרגול ללא הערכה: מיומנויות מקובצות לתובנה אחת', () => {
    const r = buildInsights(fill(3, { T5: 1, R5: 0, C5: 3, H5: 3 }));
    const p = r.find((i) => i.id === 'practiced_not_assessed')!;
    expect(p.skills).toEqual(['T', 'R']);
    expect(p.title).toContain('עבודת צוות וחשיבה יצירתית');
    expect(p.title).toContain('מתורגלות');
  });
  it('אין הערכה לאף מיומנות → תובנה כוללת אחת במקום פירוט לכל מיומנות', () => {
    const r = ids(fill(3, { T5: 0, C5: 1, R5: 0, H5: 1 }));
    expect(r).toContain('no_assessment_at_all');
    expect(r).not.toContain('practiced_not_assessed');
  });
  it('תרגול חלקי מציין את ההיבטים החזקים והחלשים בשמם', () => {
    const r = buildInsights(fill(2, { T1: 4, T2: 4, T3: 1, T4: 0 }));
    const p = r.find((i) => i.id === 'partial_practice')!;
    expect(p.skills).toEqual(['T']);
    expect(p.text).toContain('תלות הדדית ותיאום פעולות נדרשים במידה רבה');
    expect(p.text).toContain('התמודדות עם אי-הסכמות כמעט אינו נדרש');
  });
  it('מיומנות שאינה נוכחת מזוהה; קורס ממוקד במיומנות אחת', () => {
    const r = ids(fill(1, { R1: 0, R2: 0, R3: 0, R4: 0, R5: 0, T1: 4, T2: 4, T3: 3, T4: 3, T5: 3 }));
    expect(r).toContain('absent');
    expect(r).toContain('single_focus');
  });
  it('אין דפוס בולט → תובנת ברירת מחדל', () => {
    expect(ids(fill(2))).toEqual(['balanced_middle']);
  });
  it('לכל היותר ארבע תובנות, דטרמיניסטי, ללא כפילות', () => {
    for (const v of [0, 1, 2, 3, 4] as const) {
      const a = fill(v, { T1: 4, T4: 0, C5: 4, H5: 0 });
      const r = buildInsights(a);
      expect(r.length).toBeGreaterThan(0);
      expect(r.length).toBeLessThanOrEqual(MAX_INSIGHTS);
      expect(new Set(r.map((i) => i.id)).size).toBe(r.length);
      expect(buildInsights(a)).toEqual(r);
    }
  });
  it('שם מיומנות עם פסיק מוקף במירכאות ברשימה', () => {
    const p = buildInsights(fill(3, { T5: 0, H5: 0, C5: 3, R5: 3 })).find((i) => i.id === 'practiced_not_assessed')!;
    expect(p.title).toBe('עבודת צוות ו״חוסן, גמישות והסתגלות״ מתורגלות אך כמעט אינן מוערכות');
    const one = buildInsights(fill(3, { H5: 0, T5: 3, C5: 3, R5: 3 })).find((i) => i.id === 'practiced_not_assessed')!;
    expect(one.title).toBe('חוסן, גמישות והסתגלות מתורגלת אך כמעט אינה מוערכת');
  });
  it('חיבור רשימות בעברית', () => {
    expect(joinHe(['א'])).toBe('א');
    expect(joinHe(['א', 'ב'])).toBe('א וב');
    expect(joinHe(['א', 'ב', 'ג'])).toBe('א, ב וג');
  });
});
