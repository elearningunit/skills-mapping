import { SKILLS, type SkillKey } from '../config/questionnaire';
import type { Answers, CompleteAnswers } from './types';

export interface SkillScore {
  key: SkillKey;
  practice: number; // X_P = (X1+X2+X3+X4)/4 — לא מעוגל
  assessment: number; // X_A = X5
  gap: number; // X_P − X_A — לשימוש פנימי בלבד, לא מוצג כמדד איכות
}

export function scoreSkill(answers: CompleteAnswers, key: SkillKey): SkillScore {
  const s = SKILLS.find((x) => x.key === key)!;
  const practiceItems = s.items.filter((i) => i.kind === 'practice');
  const assessmentItem = s.items.find((i) => i.kind === 'assessment')!;
  const practice = practiceItems.reduce((sum, i) => sum + answers[i.code], 0) / practiceItems.length;
  const assessment = answers[assessmentItem.code];
  return { key, practice, assessment, gap: practice - assessment };
}

export function scoreAll(answers: CompleteAnswers): Record<SkillKey, SkillScore> {
  return Object.fromEntries(SKILLS.map((s) => [s.key, scoreSkill(answers, s.key)])) as Record<SkillKey, SkillScore>;
}

export type ScoreMap = Partial<Record<SkillKey, SkillScore>>;

/**
 * ציונים רק למיומנויות שמולאו. מיומנות שסומנה כלא רלוונטית אינה מופיעה במפה כלל
 * (אין לה ציון 0, אין תרגול ואין הערכה). חישוב המיומנויות שמולאו זהה ל-scoreSkill.
 */
export function scoreApplicable(answers: Answers, notApplicable: SkillKey[] = []): ScoreMap {
  const out: ScoreMap = {};
  for (const s of SKILLS) {
    if (!notApplicable.includes(s.key)) out[s.key] = scoreSkill(answers as CompleteAnswers, s.key);
  }
  return out;
}

/** עיגול לשתי ספרות — לתצוגה ולייצוא בלבד */
export function fmt2(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}
