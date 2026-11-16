import { SKILLS, type SkillKey } from '../config/questionnaire';
import type { Answers, CompleteAnswers } from './types';
import { scoreApplicable, type SkillScore } from './scoring';

// מחולל תובנות דטרמיניסטי: מזהה דפוסים בפרופיל הקורס ומסביר את משמעותם.
// התובנות מתייחסות לקורס (דרישות והערכה) ולא לסטודנטים. ההמלצות לפעולה נמצאות ב-recommendations.ts.

export type InsightId =
  | 'no_assessment_at_all'
  | 'assessed_not_practiced'
  | 'practiced_not_assessed'
  | 'absent'
  | 'single_focus'
  | 'partial_practice'
  | 'aligned_strength'
  | 'balanced_middle';

export interface Insight {
  id: InsightId;
  skills: SkillKey[];
  title: string;
  text: string;
  priority: number;
}

export const MAX_INSIGHTS = 4;
const GAP = 1.5; // פער משמעותי בין תרגול להערכה (בנקודות סולם)
const SPREAD = 3; // פער משמעותי בין שאלות התרגול של אותה מיומנות

const skill = (k: SkillKey) => SKILLS.find((s) => s.key === k)!;
const name = (k: SkillKey) => skill(k).name;

/** חיבור רשימה בעברית: "א", "א וב", "א, ב וג" */
export function joinHe(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} ו${items[items.length - 1]}`;
}

/** ברשימה של כמה מיומנויות, שם שמכיל פסיק מוקף במירכאות כדי שגבולות השמות יהיו ברורים */
const names = (ks: SkillKey[]) =>
  joinHe(ks.map((k) => (ks.length > 1 && name(k).includes(',') ? `״${name(k)}״` : name(k))));
/** בחירת צורת יחיד או רבים (המיומנויות בלשון נקבה) */
const sp = (ks: SkillKey[], one: string, many: string) => (ks.length === 1 ? one : many);

export function buildInsights(answers: Answers, max = MAX_INSIGHTS, notApplicable: SkillKey[] = []): Insight[] {
  // התובנות מתייחסות רק למיומנויות שמולאו; מיומנות שסומנה כלא רלוונטית אינה נחשבת "חסרה"
  const scores = scoreApplicable(answers, notApplicable);
  const all = Object.values(scores) as SkillScore[];
  if (!all.length) return [];
  const full = answers as CompleteAnswers;
  const keys = (pred: (s: SkillScore) => boolean) => all.filter(pred).map((s) => s.key);
  const out: Insight[] = [];
  const covered = new Set<SkillKey>(); // מיומנויות שכבר הוסברו בתובנה בעדיפות גבוהה יותר

  // 1. מוערכת יותר משהיא מתורגלת: הדפוס הבעייתי ביותר
  const assessedAhead = keys((s) => s.assessment - s.practice >= GAP);
  if (assessedAhead.length) {
    out.push({
      id: 'assessed_not_practiced', skills: assessedAhead, priority: 100,
      title: sp(assessedAhead, `${names(assessedAhead)} נבדקת יותר משהיא מתורגלת`, `${names(assessedAhead)} נבדקות יותר משהן מתורגלות`),
      text: sp(assessedAhead,
        'ההערכה בקורס מתייחסת למיומנות זו, אך הקורס כמעט אינו מזמן לסטודנטים הזדמנויות לתרגל אותה. כך נבדקת יכולת שהקורס אינו מפתח, וההישג בה תלוי בעיקר בניסיון שהסטודנטים הביאו מבחוץ.',
        'ההערכה בקורס מתייחסת למיומנויות אלה, אך הקורס כמעט אינו מזמן לסטודנטים הזדמנויות לתרגל אותן. כך נבדקות יכולות שהקורס אינו מפתח, וההישג בהן תלוי בעיקר בניסיון שהסטודנטים הביאו מבחוץ.'),
    });
    assessedAhead.forEach((k) => covered.add(k));
  }

  // 2. אין הערכה מובנית לאף מיומנות (כשלפחות אחת מתורגלת)
  const anyPracticed = all.some((s) => s.practice >= 1);
  if (all.every((s) => s.assessment <= 1) && anyPracticed) {
    out.push({
      id: 'no_assessment_at_all', skills: all.map((s) => s.key), priority: 90,
      title: 'המיומנויות אינן חלק מההערכה בקורס',
      text: 'באף אחת מהמיומנויות אין הערכה לפי קריטריונים מוגדרים. ההערכה מתמקדת כנראה בתוכן הדיסציפלינרי, ולכן גם מה שהסטודנטים מתרגלים אינו מקבל משוב מובנה, ואין דרך לדעת אם התרגול השיג את מטרתו.',
    });
    all.forEach((s) => covered.add(s.key));
  } else {
    // 3. מתורגלת אך כמעט אינה מוערכת
    const practicedAhead = keys((s) => s.practice - s.assessment >= GAP && !covered.has(s.key));
    if (practicedAhead.length) {
      out.push({
        id: 'practiced_not_assessed', skills: practicedAhead, priority: 80,
        title: sp(practicedAhead, `${names(practicedAhead)} מתורגלת אך כמעט אינה מוערכת`, `${names(practicedAhead)} מתורגלות אך כמעט אינן מוערכות`),
        text: sp(practicedAhead,
          'הסטודנטים נדרשים להפעיל את המיומנות, אבל הקורס אינו בודק באופן מובנה עד כמה הם עושים זאת היטב. בלי הערכה ומשוב, התרגול נשאר ברמת חשיפה, והסטודנטים מקבלים מסר מובלע שהמיומנות משנית לתוכן.',
          'הסטודנטים נדרשים להפעיל את המיומנויות, אבל הקורס אינו בודק באופן מובנה עד כמה הם עושים זאת היטב. בלי הערכה ומשוב, התרגול נשאר ברמת חשיפה, והסטודנטים מקבלים מסר מובלע שהמיומנויות משניות לתוכן.'),
      });
      practicedAhead.forEach((k) => covered.add(k));
    }
  }

  // 4. מיומנות שכמעט אינה נוכחת בקורס
  const absent = keys((s) => s.practice < 1 && s.assessment < 1);
  if (absent.length && absent.length < all.length) {
    out.push({
      id: 'absent', skills: absent, priority: 70,
      title: sp(absent, `${names(absent)} כמעט אינה נוכחת בקורס`, `${names(absent)} כמעט אינן נוכחות בקורס`),
      text: sp(absent,
        'המיומנות אינה נדרשת ואינה מוערכת. אם היא אינה חלק ממטרות הקורס, זהו מצב צפוי. אם היא כן אמורה להתפתח בקורס או בשנה זו בתוכנית, זהו הפער המרכזי בפרופיל.',
        'המיומנויות אינן נדרשות ואינן מוערכות. אם הן אינן חלק ממטרות הקורס, זהו מצב צפוי. אם הן כן אמורות להתפתח בקורס או בשנה זו בתוכנית, זהו הפער המרכזי בפרופיל.'),
    });
  } else if (absent.length === all.length) {
    out.push({
      id: 'absent', skills: absent, priority: 70,
      title: 'המיומנויות אינן חלק מהקורס',
      text: 'אף אחת מהמיומנויות אינה נדרשת או מוערכת. הקורס מתמקד כנראה בהקניית תוכן. אם הקורס אמור לתרום לפיתוח מיומנויות בתוכנית, כדאי לבחור מיומנות אחת שקרובה לאופי הקורס ולהתחיל ממנה.',
    });
  }

  // 5. קורס ממוקד במיומנות אחת
  const strongP = keys((s) => s.practice >= 3);
  const weakP = keys((s) => s.practice < 2);
  if (strongP.length === 1 && weakP.length === all.length - 1 && all.length > 1) {
    out.push({
      id: 'single_focus', skills: strongP, priority: 60,
      title: `הקורס ממוקד ב${name(strongP[0])}`,
      text: `${name(strongP[0])} מתורגלת באופן מתוכנן, ושאר המיומנויות נדרשות במידה מועטה. זהו פרופיל ממוקד ולא בהכרח חיסרון: חשוב לבדוק שקורסים אחרים בתוכנית משלימים את המיומנויות האחרות.`,
    });
  }

  // 6. תרגול חלקי: היבטים מסוימים של המיומנות נדרשים מאוד ואחרים כמעט לא
  const partial = SKILLS.filter((s) => scores[s.key]).map((s) => {
    const items = s.items.filter((i) => i.kind === 'practice');
    const vals = items.map((i) => full[i.code]);
    const hi = Math.max(...vals), lo = Math.min(...vals);
    return {
      key: s.key, spread: hi - lo,
      high: items.filter((i) => full[i.code] === hi).map((i) => i.dimension),
      low: items.filter((i) => full[i.code] === lo).map((i) => i.dimension),
    };
  })
    .filter((p) => p.spread >= SPREAD)
    .sort((a, b) => b.spread - a.spread);
  if (partial.length) {
    const p = partial[0];
    out.push({
      id: 'partial_practice', skills: [p.key], priority: 55,
      title: `${name(p.key)} מתורגלת רק בחלק מהיבטיה`,
      text: `${joinHe(p.high)} ${p.high.length === 1 ? 'נדרש' : 'נדרשים'} במידה רבה, ואילו ${joinHe(p.low)} כמעט ${p.low.length === 1 ? 'אינו נדרש' : 'אינם נדרשים'}. הממוצע מסתיר את הפער הזה: הסטודנטים מתנסים במיומנות, אך לא במלואה.`,
    });
  }

  // 7. נקודת חוזק: תרגול והערכה גבוהים ומתואמים
  const aligned = keys((s) => s.practice >= 3 && s.assessment >= 3);
  if (aligned.length) {
    out.push({
      id: 'aligned_strength', skills: aligned, priority: aligned.length === all.length ? 65 : 50,
      title: aligned.length === all.length
        ? 'כל המיומנויות מתורגלות ומוערכות באופן שיטתי'
        : sp(aligned, `${names(aligned)}: נקודת החוזק של הקורס`, `${names(aligned)}: נקודות החוזק של הקורס`),
      text: aligned.length === all.length
        ? 'התרגול וההערכה מתואמים בכל המיומנויות. זהו פרופיל נדיר יחסית, ששווה לתעד כדוגמה למרצים אחרים.'
        : sp(aligned,
          'המיומנות מתורגלת לאורך הקורס ומוערכת לפי קריטריונים, כך שהתרגול וההערכה מחזקים זה את זה. המבנה הזה יכול לשמש מודל לשילוב המיומנויות האחרות.',
          'המיומנויות מתורגלות לאורך הקורס ומוערכות לפי קריטריונים, כך שהתרגול וההערכה מחזקים זה את זה. המבנה הזה יכול לשמש מודל לשילוב המיומנויות האחרות.'),
    });
  }

  // 8. ברירת מחדל: אין דפוס בולט
  if (!out.length) {
    out.push({
      id: 'balanced_middle', skills: all.map((s) => s.key), priority: 10,
      title: 'אין פערים בולטים בפרופיל',
      text: 'התרגול וההערכה של כל מיומנות קרובים זה לזה, ואין מיומנות שבולטת לטובה או לרעה. הצעד הבא הוא לבחור מיומנות אחת שמתאימה במיוחד לקורס ולבנות לה רצף תרגול והערכה לאורך הסמסטר.',
    });
  }

  return out.sort((a, b) => b.priority - a.priority).slice(0, max);
}
