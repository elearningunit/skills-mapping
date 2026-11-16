import { ITEM_CODES, type ItemCode, type Rating } from '../src/config/questionnaire';
import type { CompleteAnswers, Mapping } from '../src/lib/types';

export function fill(v: Rating, over: Partial<Record<ItemCode, Rating>> = {}): CompleteAnswers {
  return Object.fromEntries(ITEM_CODES.map((c) => [c, over[c] ?? v])) as CompleteAnswers;
}

export function mapping(answers: CompleteAnswers, details: Partial<Mapping['details']> = {}): Mapping {
  return {
    assessment_id: '3f2b8c1e-1234-4abc-9def-0123456789ab',
    assessment_date: '2026-11-12',
    details: {
      faculty: 'הפקולטה למדעי הבריאות', department: 'ריפוי בעיסוק', study_year: 2, academic_year: 'תשפ״ז',
      lecturer_name: 'ד"ר ישראלה ישראלי', course_name: 'מבוא לריפוי בעיסוק', ...details,
    },
    answers,
    not_applicable: [],
  };
}
