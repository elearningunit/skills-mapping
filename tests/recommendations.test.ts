import { describe, expect, it } from 'vitest';
import { recommend } from '../src/lib/recommendations';
import { fill } from './helpers';

describe('מחולל ההמלצות', () => {
  it('הכול 4 → המלצת שימור אחת', () => {
    const r = recommend(fill(4));
    expect(r).toHaveLength(1);
    expect(r[0].rule).toBe('maintain');
  });
  it('הכול 0 → תרגול מכוון לכל מיומנות, עד שלוש', () => {
    const r = recommend(fill(0));
    expect(r).toHaveLength(3);
    expect(r.every((x) => x.rule === 'low_practice')).toBe(true);
    expect(new Set(r.map((x) => x.skill)).size).toBe(3);
  });
  it('X_P ≥ 3 וגם X_A ≤ 1 → הערכה מפורשת', () => {
    const r = recommend(fill(3, { T5: 1 }));
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ rule: 'assess_lags', skill: 'T' });
  });
  it('X_A = 0 וגם 2 ≤ X_P < 3 → הערכה מעצבת', () => {
    const r = recommend(fill(3, { C1: 2, C2: 2, C3: 2, C4: 2, C5: 0 }));
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ rule: 'no_assessment', skill: 'C' });
  });
  it('המנוע חל גם על המיומנות הרביעית', () => {
    const r = recommend(fill(4, { H1: 1, H2: 0, H3: 1, H4: 1 }));
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ rule: 'low_practice', skill: 'H' });
    expect(r[0].text).toContain('H2');
    expect(recommend(fill(3, { H5: 0 }))[0]).toMatchObject({ rule: 'assess_lags', skill: 'H' });
  });
  it('X_P < 2 מציין את הפריט הנמוך ביותר', () => {
    const r = recommend(fill(4, { R1: 2, R2: 0, R3: 2, R4: 1 }));
    expect(r[0]).toMatchObject({ rule: 'low_practice', skill: 'R' });
    expect(r[0].text).toContain('R2');
    expect(r[0].text).not.toContain('R1');
  });
  it('לכל היותר המלצה אחת לכל מיומנות ולכל היותר שלוש', () => {
    for (const v of [0, 1, 2, 3, 4] as const) {
      const r = recommend(fill(v, { T5: 0, C5: 4 }));
      expect(r.length).toBeLessThanOrEqual(3);
      const skills = r.map((x) => x.skill);
      expect(new Set(skills).size).toBe(skills.length);
    }
  });
  it('ערכים בינוניים ללא כלל מתאים → ללא המלצות', () => {
    expect(recommend(fill(2))).toEqual([]);
  });
  it('דטרמיניסטי', () => {
    const a = fill(1, { T1: 4, C5: 0 });
    expect(recommend(a)).toEqual(recommend(a));
  });
});
