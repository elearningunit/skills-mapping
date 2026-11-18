import type { ItemCode, Rating, SkillKey } from '../config/questionnaire';

export interface CourseDetails {
  faculty: string;
  department: string;
  study_year: number | null; // 1–5
  academic_year: string; // שנה אקדמית, למשל תשפ״ז
  lecturer_name: string;
  course_name: string;
  /** מספר הקורס מתוך רשימת הקורסים; ריק כשהקורס הוקלד ידנית ("אחר") */
  course_number?: string;
}

export type Answers = Partial<Record<ItemCode, Rating>>;
export type CompleteAnswers = Record<ItemCode, Rating>;

export interface Mapping {
  assessment_id: string;
  assessment_date: string; // YYYY-MM-DD
  details: CourseDetails;
  /** תשובות למיומנויות שמולאו. למיומנות שסומנה כלא רלוונטית אין תשובות בשימוש. */
  answers: Answers;
  /** מיומנויות שהמרצה סימן "אינה רלוונטית לקורס שלי" (סטטוס not_applicable): אין להן ציון, ואינן נחשבות 0 */
  not_applicable: SkillKey[];
}
