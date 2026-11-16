import { describe, expect, it } from 'vitest';
import { ALL_ITEMS, ANCHORS, QUESTIONNAIRE_VERSION, SKILLS } from '../src/config/questionnaire';
import { isComplete, normalizeText, validateDetails } from '../src/lib/validation';
import { fill } from './helpers';

describe('שאלון 0.5', () => {
  it('בדיוק 20 שאלות בארבע קבוצות של חמש; שאלה 5 היא הערכה', () => {
    expect(QUESTIONNAIRE_VERSION).toBe('0.5');
    expect(ALL_ITEMS).toHaveLength(20);
    expect(SKILLS.map((s) => s.key)).toEqual(['T', 'C', 'R', 'H']);
    SKILLS.forEach((s) => {
      expect(s.items.map((i) => i.code)).toEqual([1, 2, 3, 4, 5].map((n) => s.key + n));
      expect(s.items.map((i) => i.kind)).toEqual(['practice', 'practice', 'practice', 'practice', 'assessment']);
    });
  });

  it('15 השאלות המאושרות לא השתנו', () => {
    const t = SKILLS.find((s) => s.key === 'T')!.items;
    expect(t[0].text).toBe('עד כמה הסטודנטים נדרשים לבצע משימות שהצלחתן תלויה בשילוב התרומות של חברי הצוות?');
    expect(SKILLS.find((s) => s.key === 'R')!.items[4].text).toBe('עד כמה איכות החשיבה היצירתית של הסטודנטים מוערכת באופן מובנה בקורס?');
    expect(ANCHORS[4].assessment).toBe('הערכה שיטתית ומתמשכת לפי קריטריונים מוגדרים, עם משוב לשיפור.');
  });

  it('המיומנות הרביעית: חוסן, גמישות והסתגלות, H1–H5', () => {
    const h = SKILLS[3];
    expect(h.name).toBe('חוסן, גמישות והסתגלות');
    expect(h.items.map((i) => i.dimension)).toEqual([
      'התמודדות עם עמימות ואי־ודאות', 'גמישות והסתגלות לשינוי', 'התמדה ותפקוד במצבי קושי',
      'רפלקציה ולמידה מהתנסות', 'הערכת חוסן, גמישות והסתגלות',
    ]);
  });

  it('לכל מיומנות הגדרה בת שתי שורות שאינה ריקה', () => {
    SKILLS.forEach((s) => {
      expect(s.definition).toHaveLength(2);
      s.definition.forEach((l) => expect(l.trim().length).toBeGreaterThan(10));
    });
  });

  it('0 הוא ערך תקף; ערך חסר אינו תקף', () => {
    expect(isComplete(fill(0))).toBe(true);
    const a = { ...fill(2) } as Record<string, number>;
    delete a.C3;
    expect(isComplete(a)).toBe(false);
    const b = { ...fill(2) } as Record<string, number>;
    delete b.H5;
    expect(isComplete(b)).toBe(false);
  });
});

describe('פרטי הקורס', () => {
  const ok = { faculty: 'הפקולטה להנדסה', department: 'הנדסה אזרחית', study_year: 1, lecturer_name: 'א', course_name: 'ב' };
  it('כל חמשת השדות חובה', () => {
    expect(validateDetails(ok)).toEqual({});
    for (const k of Object.keys(ok) as (keyof typeof ok)[]) {
      const bad = { ...ok, [k]: k === 'study_year' ? null : '' };
      expect(Object.keys(validateDetails(bad))).toContain(k);
    }
  });
  it('שם המורכב מרווחים בלבד נדחה; רווחים עודפים מוסרים', () => {
    expect(validateDetails({ ...ok, lecturer_name: '   ' }).lecturer_name).toBeTruthy();
    expect(normalizeText('  ד"ר   כהן \t ')).toBe('ד"ר כהן');
  });
  it('מחלקה שאינה שייכת לפקולטה נדחית', () => {
    expect(validateDetails({ ...ok, department: 'פיזיקה' }).department).toBeTruthy();
  });
  it('שנת לימודים 1–5 בלבד', () => {
    expect(validateDetails({ ...ok, study_year: 6 }).study_year).toBeTruthy();
    expect(validateDetails({ ...ok, study_year: 5 })).toEqual({});
  });
});
