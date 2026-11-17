import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { courseLabel, coursesOf, findCourse, hasCatalog, isListedLecturer, lecturersOf, setCatalog, type Catalog } from '../src/lib/courses';

const OUT = new URL('./fixtures/courses.json', import.meta.url);

describe('רשימת קורסים ומרצים', () => {
  it('המחולל: מאחד כפילויות, ממיר שנה (א׳/1), מדלג על מחלקה לא מוכרת ומדווח עליה', () => {
    const log = execFileSync('node', ['scripts/gen-courses.mjs', 'tests/fixtures/courses.csv', OUT.pathname], { encoding: 'utf8' });
    expect(log).toContain('2 departments, 4 courses, 4 lecturers');
    expect(log).toContain('מחלקה שלא קיימת');
    const c = JSON.parse(readFileSync(OUT, 'utf8')) as Catalog;
    expect(Object.keys(c)).toEqual(['סיעוד', 'ריפוי בעיסוק']);
    expect(c['סיעוד'].courses).toEqual([['1001', 'יסודות הסיעוד (דוגמה)', 1], ['1003', 'סיעוד קהילתי (דוגמה)', 3], ['1002', 'פרמקולוגיה (דוגמה)', 2]]);
  });

  it('מרצים וקורסים לפי מחלקה; מרצה שאינו ברשימה רואה את כל קורסי המחלקה', () => {
    setCatalog(JSON.parse(readFileSync(OUT, 'utf8')));
    expect(hasCatalog('סיעוד')).toBe(true);
    expect(hasCatalog('פיזיותרפיה')).toBe(false);
    expect(lecturersOf('סיעוד')).toEqual(['ד"ר יעל אברהם (דוגמה)', 'ד"ר נועה לוי (דוגמה)', 'פרופ׳ אבי כהן (דוגמה)']);
    expect(coursesOf('סיעוד', 'ד"ר נועה לוי (דוגמה)').map(courseLabel)).toEqual(['יסודות הסיעוד (דוגמה) (1001)', 'פרמקולוגיה (דוגמה) (1002)']);
    expect(coursesOf('סיעוד', 'מרצה חדש')).toHaveLength(3);
    expect(coursesOf('פיזיותרפיה')).toEqual([]);
    expect(isListedLecturer('סיעוד', ' ד"ר  נועה לוי (דוגמה) ')).toBe(true);
    expect(isListedLecturer('סיעוד', 'מרצה חדש')).toBe(false);
    expect(findCourse('סיעוד', 'ד"ר נועה לוי (דוגמה)', 'פרמקולוגיה (דוגמה)')?.year).toBe(2);
    expect(findCourse('סיעוד', 'ד"ר נועה לוי (דוגמה)', 'קורס אחר')).toBeUndefined();
  });

  it('ללא קובץ קורסים: הרשימה ריקה והמרצה מקליד ידנית', () => {
    expect(readFileSync(new URL('../src/config/courses.json', import.meta.url), 'utf8').trim()).toBe('{}');
  });
});
