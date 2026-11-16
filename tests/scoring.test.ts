import { describe, expect, it } from 'vitest';
import { fmt2, scoreAll } from '../src/lib/scoring';
import { fill } from './helpers';

describe('חישוב P ו-A', () => {
  it('הכול 0', () => {
    const s = scoreAll(fill(0));
    for (const k of ['T', 'C', 'R', 'H'] as const) expect([s[k].practice, s[k].assessment]).toEqual([0, 0]);
  });
  it('הכול 4', () => {
    const s = scoreAll(fill(4));
    for (const k of ['T', 'C', 'R', 'H'] as const) expect([s[k].practice, s[k].assessment]).toEqual([4, 4]);
  });
  it('ערכים מעורבים; ההערכה אינה משוקללת בתרגול', () => {
    const s = scoreAll(fill(0, { T1: 1, T2: 2, T3: 3, T4: 3, T5: 0, C1: 4, C2: 4, C3: 4, C4: 3, C5: 1, R1: 1, R2: 0, R3: 0, R4: 0, R5: 4 }));
    expect(s.T.practice).toBe(2.25);
    expect(s.T.assessment).toBe(0);
    expect(s.C.practice).toBe(3.75);
    expect(s.C.assessment).toBe(1);
    expect(s.R.practice).toBe(0.25);
    expect(s.R.assessment).toBe(4);
    expect(s.R.gap).toBe(-3.75);
    expect(s.H.practice).toBe(0);
  });
  it('H_P = ממוצע H1–H4; H_A = H5', () => {
    const s = scoreAll(fill(0, { H1: 4, H2: 3, H3: 2, H4: 2, H5: 1 }));
    expect(s.H.practice).toBe(2.75);
    expect(s.H.assessment).toBe(1);
  });
  it('עיגול לשתי ספרות לתצוגה בלבד', () => {
    expect(fmt2(2.25)).toBe('2.25');
    expect(fmt2(0)).toBe('0.00');
    expect(fmt2(4)).toBe('4.00');
    expect(fmt2(1.005 + 1e-9)).toBe('1.01');
  });
});
