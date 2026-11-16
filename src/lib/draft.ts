import type { SkillKey } from '../config/questionnaire';
import type { Answers, CourseDetails } from './types';

const KEY = 'skills-mapping:draft:v0.5';

export interface Draft {
  details: CourseDetails;
  answers: Answers;
  step: number;
  assessment_id: string;
  /** מיומנויות שסומנו "אינה רלוונטית לקורס שלי" */
  not_applicable?: SkillKey[];
  /** תאריך המיפוי: נקבע בפעם הראשונה שהוצגו התוצאות ואינו משתנה אחר כך */
  assessment_date?: string;
}

const LEGACY_KEYS = ['skills-mapping:draft:v0.4'];

export function loadDraft(): Draft | null {
  try {
    // טיוטות של גרסאות שאלון קודמות אינן תואמות; מוחקים אותן (כוללות שם מרצה)
    for (const k of LEGACY_KEYS) localStorage.removeItem(k);
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

export function saveDraft(d: Draft): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
    return true;
  } catch {
    return false;
  }
}

export function deleteDraft(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* אחסון חסום — אין מה למחוק */
  }
}
