import { QUESTIONNAIRE_VERSION, SKILLS, type ItemCode, type SkillKey } from '../config/questionnaire';
import type { Mapping } from './types';
import { fmt2, scoreApplicable } from './scoring';
import { normalizeText } from './validation';

const codes = (k: SkillKey) => SKILLS.find((s) => s.key === k)!.items.map((i) => i.code);

/**
 * סדר העמודות: 29 העמודות של גרסה 0.4 נשארות במקומן, ובלוק המיומנות הרביעית (H) נוסף בסוף.
 * כך קובצי 0.4 ו-0.5 ניתנים לאיחוד לפי מיקום העמודות. סה״כ 36 עמודות.
 */
export const CSV_COLUMNS: string[] = [
  'assessment_id', 'faculty', 'department', 'study_year', 'lecturer_name', 'course_name',
  'assessment_date', 'questionnaire_version',
  ...codes('T'), ...codes('C'), ...codes('R'),
  'T_P', 'T_A', 'C_P', 'C_A', 'R_P', 'R_A',
  ...codes('H'), 'H_P', 'H_A',
  // סטטוס לכל מיומנות: answered | not_applicable (נוסף בסוף, כדי לא להזיז עמודות קיימות)
  ...SKILLS.map((s) => `${s.key}_status`),
  // שנה אקדמית — נוספה בסוף, כדי לא להזיז עמודות קיימות
  'academic_year',
];

export const STATUS_ANSWERED = 'answered';
export const STATUS_NOT_APPLICABLE = 'not_applicable';

/** הגנה מפני CSV formula injection בשדות טקסט חופשיים — בקובץ בלבד */
export function guardFormula(s: string): string {
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

/** בריחה לפי RFC 4180 */
export function escapeCsv(v: string | number): string {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function mappingToRow(m: Mapping): (string | number)[] {
  const sc = scoreApplicable(m.answers, m.not_applicable);
  const d = m.details;
  const values: Record<string, string | number> = {
    assessment_id: m.assessment_id,
    faculty: d.faculty,
    department: d.department,
    study_year: d.study_year as number,
    lecturer_name: guardFormula(normalizeText(d.lecturer_name)),
    course_name: guardFormula(normalizeText(d.course_name)),
    assessment_date: m.assessment_date,
    questionnaire_version: QUESTIONNAIRE_VERSION,
    academic_year: d.academic_year,
  };
  for (const s of SKILLS) {
    const score = sc[s.key];
    // מיומנות שסומנה כלא רלוונטית: תאי השאלות והציונים ריקים (לא 0), והסטטוס not_applicable
    for (const i of s.items) values[i.code] = score ? (m.answers[i.code as ItemCode] as number) : '';
    values[`${s.key}_P`] = score ? fmt2(score.practice) : '';
    values[`${s.key}_A`] = score ? fmt2(score.assessment) : '';
    values[`${s.key}_status`] = score ? STATUS_ANSWERED : STATUS_NOT_APPLICABLE;
  }
  return CSV_COLUMNS.map((c) => {
    if (!(c in values)) throw new Error(`missing CSV value: ${c}`);
    return values[c];
  });
}

/** CSV מלא: BOM + שורת כותרת + שורת נתונים אחת, שורות מסתיימות ב-CRLF */
export function buildCsv(m: Mapping): string {
  const lines = [CSV_COLUMNS.join(','), mappingToRow(m).map(escapeCsv).join(',')];
  return '﻿' + lines.join('\r\n') + '\r\n';
}

export function csvFilename(m: Mapping): string {
  return `skills-mapping_${m.assessment_date}_${m.assessment_id.slice(0, 8)}.csv`;
}
