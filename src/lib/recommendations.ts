import { SKILL_KEYS, SKILLS, type ItemCode, type SkillKey } from '../config/questionnaire';
import type { Answers, CompleteAnswers } from './types';
import { scoreApplicable, type SkillScore } from './scoring';

// מחולל המלצות דטרמיניסטי (אפיון 1.3 סעיף 7; הורחב לארבע מיומנויות באפיון 1.4). הספים הם כללי יישום התחלתיים בלבד.
export const HIGH = 3;
export const LOW = 2;

export type RuleId = 'assess_lags' | 'low_practice' | 'no_assessment' | 'maintain';

export interface Recommendation {
  rule: RuleId;
  skill: SkillKey | null;
  title: string;
  text: string;
  priority: number; // גבוה = חשוב יותר
}

function skillName(k: SkillKey) {
  return SKILLS.find((s) => s.key === k)!.name;
}

/** הפריט/ים בעלי הדירוג הנמוך ביותר מבין פריטי התרגול של המיומנות */
export function lowestPracticeItems(answers: CompleteAnswers, k: SkillKey) {
  const items = SKILLS.find((s) => s.key === k)!.items.filter((i) => i.kind === 'practice');
  const min = Math.min(...items.map((i) => answers[i.code]));
  return items.filter((i) => answers[i.code] === min);
}

/** כלל אחד לכל היותר לכל מיומנות, כדי למנוע המלצות סותרות או כפולות */
function ruleForSkill(answers: CompleteAnswers, s: SkillScore): Recommendation | null {
  const name = skillName(s.key);
  if (s.practice >= HIGH && s.assessment <= 1) {
    return {
      rule: 'assess_lags', skill: s.key, priority: 30 + s.gap,
      title: `${name}: הערכה מפורשת`,
      text: `המיומנות מתורגלת ברמה גבוהה יחסית להערכתה. שקלו קריטריון מפורש ומשוב מובנה במטלה קיימת.`,
    };
  }
  if (s.practice < LOW) {
    const low = lowestPracticeItems(answers, s.key);
    const names = low.map((i) => `${i.dimension} (${i.code})`).join(', ');
    return {
      rule: 'low_practice', skill: s.key, priority: 20 + (LOW - s.practice),
      title: `${name}: תרגול מכוון`,
      text: `שקלו לשלב תרגול קצר ומכוון של אחת ההתנהגויות בעלות הדירוג הנמוך ביותר: ${names}.`,
    };
  }
  if (s.assessment === 0 && s.practice > 0) {
    return {
      rule: 'no_assessment', skill: s.key, priority: 10 + s.practice,
      title: `${name}: הערכה מעצבת`,
      text: `שקלו להוסיף כלי הערכה מעצבת קצר המתייחס למיומנות.`,
    };
  }
  return null;
}

export function recommend(answers: Answers, max = 3, notApplicable: SkillKey[] = []): Recommendation[] {
  // מיומנויות שסומנו כלא רלוונטיות אינן נכללות
  const all = Object.values(scoreApplicable(answers, notApplicable)) as SkillScore[];
  if (!all.length) return [];
  const full = answers as CompleteAnswers;
  const allHigh = all.every((s) => s.practice >= HIGH && s.assessment >= HIGH);
  if (allHigh) {
    return [{
      rule: 'maintain', skill: null, priority: 0,
      title: 'שימור',
      text: 'המשיכו לשמר את ההזדמנויות לתרגול ולהערכה; שקלו לתעד דוגמה טובה לשימוש עתידי.',
    }];
  }
  const order: SkillKey[] = SKILL_KEYS;
  return all
    .map((s) => ruleForSkill(full, s))
    .filter((r): r is Recommendation => r !== null)
    .sort((a, b) => b.priority - a.priority || order.indexOf(a.skill!) - order.indexOf(b.skill!))
    .slice(0, max);
}

export type { ItemCode };
