// מודל הנתונים של ממשק הרשות: הופך שורות גיליון לרשומות, מתרגם סימונים לעברית, מסנן ומחפש.
import { SKILLS, STUDY_YEARS, type ItemCode, type SkillKey } from '../config/questionnaire';

export type Status = 'valid' | 'flagged' | 'excluded';
export type Decision = '' | 'included' | 'excluded';
export type Action = 'include' | 'exclude' | 'reset' | 'replace_previous';

export interface SkillResult {
  key: SkillKey;
  notApplicable: boolean;
  practice: number | null;
  assessment: number | null;
}

export interface AdminRecord {
  id: string;
  createdAt: string; // ISO
  receivedAt: string; // ISO
  assessmentDate: string; // YYYY-MM-DD
  faculty: string;
  department: string;
  academicYear: string;
  studyYear: number | null;
  lecturer: string;
  course: string;
  courseNumber: string;
  version: string;
  answers: Partial<Record<ItemCode, number | null>>;
  skills: SkillResult[];
  status: Status;
  flags: string[];
  decision: Decision;
  submissions: number;
}

export interface LogEntry { time: string; actor: string; action: string; assessment_id: string; details: string }
export interface AdminData { me: string; rows: Record<string, unknown>[]; log: LogEntry[]; loadedAt: string }

const num = (x: unknown): number | null => {
  if (x === '' || x === null || x === undefined) return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
};

/** תאריך מיפוי: טקסט YYYY-MM-DD, או תאריך שהגיליון המיר (ISO) — מוצג לפי השעון המקומי */
function dateOnly(x: unknown): string {
  const s = String(x ?? '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function toRecord(r: Record<string, unknown>): AdminRecord {
  const answers: AdminRecord['answers'] = {};
  const skills: SkillResult[] = SKILLS.map((s) => {
    for (const i of s.items) answers[i.code] = num(r[i.code]);
    const notApplicable = r[`${s.key}_status`] === 'not_applicable';
    return {
      key: s.key,
      notApplicable,
      practice: notApplicable ? null : num(r[`${s.key}_P`]),
      assessment: notApplicable ? null : num(r[`${s.key}_A`]),
    };
  });
  const status = String(r.status || '');
  const decision = (['included', 'excluded'].includes(String(r.decision)) ? r.decision : '') as Decision;
  return {
    id: String(r.assessment_id ?? ''),
    createdAt: String(r.created_at || r.received_at || ''),
    receivedAt: String(r.received_at || ''),
    assessmentDate: dateOnly(r.assessment_date),
    faculty: String(r.faculty ?? ''),
    department: String(r.department ?? ''),
    academicYear: String(r.academic_year ?? ''),
    studyYear: num(r.study_year),
    lecturer: String(r.lecturer_name ?? ''),
    course: String(r.course_name ?? ''),
    courseNumber: String(r.course_number ?? '').replace(/^'/, ''),
    version: String(r.questionnaire_version ?? ''),
    answers,
    skills,
    // שורה שלא עברה הסבה (אין סטטוס) מוצגת "לבדיקה", כדי שלא תיספר בטעות
    // ההכרעה של הרשות קובעת; בלעדיה — הסטטוס שהקולט חישב. שורה ללא סטטוס (לא עברה הסבה) — "לבדיקה"
    status: decision === 'excluded' ? 'excluded' : decision === 'included' ? 'valid'
      : status === 'valid' || status === 'excluded' ? status : 'flagged',
    flags: String(r.flags || '').split(' ').filter(Boolean).concat(status ? [] : ['not_migrated']),
    decision,
    submissions: num(r.submissions) ?? 1,
  };
}

/* ---------------- תצוגה ---------------- */

export const STATUS_LABELS: Record<Status, string> = { valid: 'תקין', flagged: 'לבדיקה', excluded: 'מוחרג' };

const SKILL_NAME = Object.fromEntries(SKILLS.map((s) => [s.key, s.name])) as Record<SkillKey, string>;
const FIELD_NAMES: Record<string, string> = {
  faculty: 'פקולטה', department: 'מחלקה', lecturer_name: 'שם המרצה', course_name: 'שם הקורס', course_number: 'מספר קורס',
  study_year: 'שנה בתואר', academic_year: 'שנה אקדמית', assessment_date: 'תאריך המיפוי', questionnaire_version: 'גרסת שאלון',
};

/** הסבר בעברית לכל סימון שהקולט קבע */
export function flagLabel(flag: string): string {
  if (flag.startsWith('possible_duplicate:')) return 'כפילות אפשרית';
  if (flag === 'unknown_unit') return 'הפקולטה והמחלקה אינן תואמות לרשימה הרשמית';
  if (flag === 'missing_academic_year') return 'חסרה שנה אקדמית';
  if (flag === 'not_migrated') return 'השורה טרם עברה הסבה לקולט החדש';
  let m = flag.match(/^score_mismatch_([TCRH])$/);
  if (m) return `הציון שנשלח אינו תואם לתשובות (${SKILL_NAME[m[1] as SkillKey]})`;
  m = flag.match(/^invalid_([TCRH])_status$/);
  if (m) return `סטטוס לא תקין (${SKILL_NAME[m[1] as SkillKey]})`;
  m = flag.match(/^invalid_([TCRH][1-5])$/);
  if (m) return `ערך לא תקין בהיגד ${m[1]}`;
  m = flag.match(/^invalid_(.+)$/);
  if (m) return `ערך לא תקין: ${FIELD_NAMES[m[1]] ?? m[1]}`;
  return flag;
}

/** מזהי הדיווחים שהדיווח הזה עשוי לשכפל */
export function duplicateRefs(r: AdminRecord): string[] {
  return r.flags.filter((f) => f.startsWith('possible_duplicate:')).map((f) => f.slice('possible_duplicate:'.length));
}

/** הפעולות שמוצעות לכל דיווח, לפי מצבו */
export function actionsFor(r: AdminRecord): { action: Action; label: string; primary?: boolean }[] {
  if (r.status === 'excluded') return [{ action: 'reset', label: 'ביטול ההחרגה' }];
  if (r.status === 'flagged') {
    if (duplicateRefs(r).length) {
      return [
        { action: 'replace_previous', label: 'זה דיווח חדש שמחליף את הקודם', primary: true },
        { action: 'include', label: 'שניהם תקינים' },
        { action: 'exclude', label: 'החרגה' },
      ];
    }
    return [
      { action: 'include', label: 'הכללה בחישובים', primary: true },
      { action: 'exclude', label: 'החרגה' },
    ];
  }
  // תקין
  if (r.decision === 'included') return [{ action: 'reset', label: 'ביטול ההכרעה' }, { action: 'exclude', label: 'החרגה' }];
  return [{ action: 'exclude', label: 'החרגה' }];
}

export const ACTION_LOG_LABELS: Record<string, string> = {
  received: 'התקבל', updated: 'עודכן (נשלח שוב)', migrated: 'הוסב לקולט החדש',
  included: 'הוכלל בחישובים', excluded: 'הוחרג', reopened: 'נשלח שוב עם שינוי וחזר לבדיקה', reset: 'ההכרעה בוטלה', included_replacing: 'הוכלל במקום הדיווח הקודם',
};

export function yearLabel(y: number | null): string {
  return STUDY_YEARS.find((s) => s.value === y)?.label ?? (y === null ? '' : String(y));
}

export function formatDate(iso: string): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00`) : new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${formatDate(iso)} ${d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;
}

/* ---------------- סינון וחיפוש ---------------- */

export interface Filters {
  faculty: string;
  department: string;
  academicYear: string;
  studyYear: string; // '' או '1'..'5'
  status: '' | Status;
  q: string;
}

export const EMPTY_FILTERS: Filters = { faculty: '', department: '', academicYear: '', studyYear: '', status: '', q: '' };

/** נרמול לחיפוש: בלי מירכאות, תארים ורווחים כפולים */
export function normalize(s: string): string {
  return s.toLowerCase()
    .replace(/["'`״׳”“’‘]/g, '')
    .replace(/(^|\s)(דר|פרופסור|פרופ|prof|dr)\.?(?=\s|$)/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

export function applyFilters(rows: AdminRecord[], f: Filters): AdminRecord[] {
  const q = normalize(f.q);
  return rows.filter((r) =>
    (!f.faculty || r.faculty === f.faculty) &&
    (!f.department || r.department === f.department) &&
    (!f.academicYear || r.academicYear === f.academicYear) &&
    (!f.studyYear || String(r.studyYear) === f.studyYear) &&
    (!f.status || r.status === f.status) &&
    (!q || normalize(`${r.course} ${r.courseNumber} ${r.lecturer}`).includes(q)),
  );
}

export function counts(rows: AdminRecord[]) {
  return {
    total: rows.length,
    valid: rows.filter((r) => r.status === 'valid').length,
    flagged: rows.filter((r) => r.status === 'flagged').length,
    excluded: rows.filter((r) => r.status === 'excluded').length,
  };
}

/** מיון ברירת מחדל: החדש ביותר למעלה */
export function sortNewestFirst(rows: AdminRecord[]): AdminRecord[] {
  return [...rows].sort((a, b) => (b.createdAt > a.createdAt ? 1 : b.createdAt < a.createdAt ? -1 : 0));
}

/* ---------------- ייצוא ---------------- */

/** CSV של התצוגה המסוננת: עמודות הגיליון המקוריות, באותו סדר */
export function exportRows(raw: Record<string, unknown>[], ids: Set<string>): Record<string, unknown>[] {
  return raw.filter((r) => ids.has(String(r.assessment_id)));
}
