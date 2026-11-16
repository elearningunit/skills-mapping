import { describe, expect, it } from 'vitest';
import { parseCsv } from '../src/lib/csvParse.mjs';
import { buildCsv } from '../src/lib/csv';
import { recommend } from '../src/lib/recommendations';
import { buildInsights } from '../src/lib/insights';
import { scoreAll, scoreApplicable } from '../src/lib/scoring';
import { isMappingComplete, isSkillDone } from '../src/lib/validation';
import type { Answers } from '../src/lib/types';
import { fill, mapping } from './helpers';

/** תשובות מלאות, ללא תשובות למיומנות שסומנה כלא רלוונטית */
function withoutSkill(a: Answers, k: string): Answers {
  return Object.fromEntries(Object.entries(a).filter(([c]) => !c.startsWith(k))) as Answers;
}

const rowOf = (csv: string) => {
  const [h, r] = parseCsv(csv);
  return Object.fromEntries(h.map((k, i) => [k, r[i]]));
};

describe('"מיומנות זו אינה רלוונטית לקורס שלי"', () => {
  it('מיומנות לא רלוונטית נחשבת מושלמת; אפשר להשלים את המיפוי בלי לענות עליה', () => {
    const a = withoutSkill(fill(2), 'R');
    expect(isMappingComplete(a, [])).toBe(false);
    expect(isSkillDone(a, ['R'], 'R')).toBe(true);
    expect(isMappingComplete(a, ['R'])).toBe(true);
  });

  it('הסימון אינו משפיע על מיומנויות אחרות: עדיין נדרשות כל התשובות שלהן', () => {
    const a = withoutSkill(fill(2), 'R');
    delete a.T3;
    expect(isMappingComplete(a, ['R'])).toBe(false);
    expect(isSkillDone(a, ['R'], 'T')).toBe(false);
  });

  it('אין ציון 0 ואין ציוני תרגול או הערכה למיומנות לא רלוונטית', () => {
    const sc = scoreApplicable(withoutSkill(fill(3), 'C'), ['C']);
    expect(sc.C).toBeUndefined();
    expect(Object.keys(sc)).toEqual(['T', 'R', 'H']);
  });

  it('חישוב המיומנויות שמולאו זהה לחישוב הקיים', () => {
    const a = fill(1, { T1: 4, T2: 3, T3: 2, T4: 0, T5: 2, H1: 4, H5: 0 });
    const full = scoreAll(a);
    const part = scoreApplicable(a, ['C', 'R']);
    expect(part.T).toEqual(full.T);
    expect(part.H).toEqual(full.H);
  });

  it('תשובות שנבחרו לפני הסימון אינן נכנסות לחישוב', () => {
    const a = fill(4); // נבחרו תשובות ל-R ואחר כך סומן "לא רלוונטי"
    expect(scoreApplicable(a, ['R']).R).toBeUndefined();
    expect(recommend(fill(0, { T1: 4, T2: 4, T3: 4, T4: 4, T5: 4, C1: 4, C2: 4, C3: 4, C4: 4, C5: 4, H1: 4, H2: 4, H3: 4, H4: 4, H5: 4 }), 3, ['R'])
      .map((r) => r.rule)).toEqual(['maintain']);
  });

  it('המלצות ותובנות אינן מתייחסות למיומנות לא רלוונטית', () => {
    const a = withoutSkill(fill(0), 'H');
    expect(recommend(a, 3, ['H']).some((r) => r.skill === 'H')).toBe(false);
    expect(buildInsights(a, undefined, ['H']).every((i) => !i.skills.includes('H'))).toBe(true);
  });

  it('כל המיומנויות לא רלוונטיות: אין המלצות ואין תובנות, ואין קריסה', () => {
    const all = ['T', 'C', 'R', 'H'] as const;
    expect(isMappingComplete({}, [...all])).toBe(true);
    expect(recommend({}, 3, [...all])).toEqual([]);
    expect(buildInsights({}, undefined, [...all])).toEqual([]);
  });

  it('CSV: תאים ריקים (לא 0) למיומנות לא רלוונטית, וסטטוס not_applicable', () => {
    const m = { ...mapping(fill(2)), answers: withoutSkill(fill(2), 'C'), not_applicable: ['C' as const] };
    const r = rowOf(buildCsv(m));
    for (let n = 1; n <= 5; n++) expect(r['C' + n]).toBe('');
    expect([r.C_P, r.C_A]).toEqual(['', '']);
    expect(r.C_status).toBe('not_applicable');
    expect(r.T_status).toBe('answered');
    expect([r.T1, r.T_P, r.H_A]).toEqual(['2', '2.00', '2.00']);
  });

  it('CSV ללא סימון: כל הסטטוסים answered', () => {
    const r = rowOf(buildCsv(mapping(fill(1))));
    expect([r.T_status, r.C_status, r.R_status, r.H_status]).toEqual(['answered', 'answered', 'answered', 'answered']);
  });
});
