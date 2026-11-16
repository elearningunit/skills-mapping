import { ITEM_CODES, SKILLS, type SkillKey } from '../config/questionnaire';
import { departmentsOf, FACULTIES } from '../config/units';
import type { Answers, CompleteAnswers, CourseDetails } from './types';

/** הסרת רווחים עודפים: חיתוך בקצוות וצמצום רצפי רווחים לרווח אחד */
export function normalizeText(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

export type DetailsErrors = Partial<Record<keyof CourseDetails, string>>;

export function validateDetails(d: CourseDetails): DetailsErrors {
  const e: DetailsErrors = {};
  if (!FACULTIES.includes(d.faculty)) e.faculty = 'יש לבחור פקולטה או בית ספר.';
  if (!d.department || !departmentsOf(d.faculty).includes(d.department)) e.department = 'יש לבחור מחלקה מתוך הרשימה.';
  if (!d.study_year || d.study_year < 1 || d.study_year > 5) e.study_year = 'יש לבחור שנת לימודים בתואר.';
  if (!normalizeText(d.lecturer_name)) e.lecturer_name = 'יש להזין את שם המרצה.';
  if (!normalizeText(d.course_name)) e.course_name = 'יש להזין את שם הקורס.';
  return e;
}

export function missingInSkill(answers: Answers, skill: SkillKey): string[] {
  const s = SKILLS.find((x) => x.key === skill)!;
  return s.items.filter((i) => answers[i.code] === undefined).map((i) => i.code);
}

/** מיומנות הושלמה: כל חמש השאלות נענו, או שסומנה כלא רלוונטית */
export function isSkillDone(answers: Answers, notApplicable: SkillKey[], skill: SkillKey): boolean {
  return notApplicable.includes(skill) || missingInSkill(answers, skill).length === 0;
}

/** המיפוי הושלם: כל מיומנות נענתה במלואה או סומנה כלא רלוונטית */
export function isMappingComplete(answers: Answers, notApplicable: SkillKey[]): boolean {
  return SKILLS.every((s) => isSkillDone(answers, notApplicable, s.key));
}

export function isComplete(answers: Answers): answers is CompleteAnswers {
  return ITEM_CODES.every((c) => {
    const v = answers[c];
    return v === 0 || v === 1 || v === 2 || v === 3 || v === 4;
  });
}
