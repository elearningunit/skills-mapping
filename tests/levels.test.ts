import { describe, expect, it } from 'vitest';
import { levelOf } from '../src/lib/levels';

describe('מפת הצבעים', () => {
  it('ציונים שלמים 0–4 ממופים לחמש רמות', () => {
    expect([0, 1, 2, 3, 4].map(levelOf)).toEqual([0, 1, 2, 3, 4]);
  });
  it('ממוצעים נופלים לרמה הנכונה', () => {
    expect(levelOf(0.75)).toBe(0);
    expect(levelOf(1.75)).toBe(1);
    expect(levelOf(2.5)).toBe(2);
    expect(levelOf(3.25)).toBe(3);
    expect(levelOf(3.5)).toBe(4);
  });
});
