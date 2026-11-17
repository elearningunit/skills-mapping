// חישובי דוח ה-PDF של ממשק הרשות: ממוצעים לפי מיומנות ולפי שנה בתואר, ונקודות לתשומת לב ברמת התוכנית.
// הדוח נשען רק על דיווחים תקינים (נספרים) מתוך התצוגה המסוננת.
import { SKILLS, STUDY_YEARS, type SkillKey } from '../config/questionnaire';
import { fmt2, type ScoreMap } from '../lib/scoring';
import { normalize, type AdminRecord, type Filters } from './model';

export interface SkillAgg {
  key: SkillKey;
  name: string;
  n: number; // קורסים שבהם המיומנות רלוונטית ויש לה ציון
  na: number; // קורסים שסימנו "לא רלוונטי"
  practice: number | null; // ממוצע
  assessment: number | null;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function aggregate(recs: AdminRecord[]): SkillAgg[] {
  return SKILLS.map((s) => {
    const res = recs.map((r) => r.skills.find((x) => x.key === s.key)!);
    const scored = res.filter((x) => !x.notApplicable && x.practice !== null && x.assessment !== null);
    return {
      key: s.key,
      name: s.name,
      n: scored.length,
      na: res.filter((x) => x.notApplicable).length,
      practice: mean(scored.map((x) => x.practice!)),
      assessment: mean(scored.map((x) => x.assessment!)),
    };
  });
}

/** ממוצעים בפורמט של תרשים העמודות; מיומנות בלי אף ציון מוצגת "לא רלוונטי" */
export function toScoreMap(aggs: SkillAgg[]): ScoreMap {
  const out: ScoreMap = {};
  for (const a of aggs) {
    if (a.practice !== null && a.assessment !== null) {
      out[a.key] = { key: a.key, practice: a.practice, assessment: a.assessment, gap: a.practice - a.assessment };
    }
  }
  return out;
}

export function byStudyYear(recs: AdminRecord[]): { year: number; label: string; n: number; skills: SkillAgg[] }[] {
  return STUDY_YEARS
    .map((y) => ({ y, rs: recs.filter((r) => r.studyYear === y.value) }))
    .filter((x) => x.rs.length)
    .map(({ y, rs }) => ({ year: y.value, label: y.label, n: rs.length, skills: aggregate(rs) }));
}

/** כותרת הדוח ושורת ההיקף, לפי הסינון שנבחר */
export function reportScope(f: Filters, recs: AdminRecord[]): { title: string; scope: string[] } {
  const lecturers = [...new Set(recs.map((r) => normalize(r.lecturer)))];
  const single = f.q && lecturers.length === 1 && recs.length ? recs[0].lecturer : '';
  const title = single
    ? single
    : f.department ? `מחלקת ${f.department}`
    : f.faculty ? f.faculty
    : 'כלל האוניברסיטה';
  const scope: string[] = [];
  if (single && f.department) scope.push(`מחלקת ${f.department}`);
  if (f.department && f.faculty) scope.push(f.faculty);
  else if (!f.department && f.faculty && single) scope.push(f.faculty);
  scope.push(f.academicYear ? `שנה אקדמית ${f.academicYear}` : 'כל השנים האקדמיות');
  if (f.studyYear) scope.push(STUDY_YEARS.find((y) => String(y.value) === f.studyYear)?.label ?? '');
  if (f.q && !single) scope.push(`חיפוש: ${f.q}`);
  return { title, scope: scope.filter(Boolean) };
}

export interface Observation { id: string; title: string; text: string }

/**
 * נקודות לתשומת לב ברמת התוכנית (לא חזרה על המספרים): פערי תרגול/הערכה, מיומנות חסרה,
 * מיומנות שנשענת על קורס יחיד, ומיומנות שרוב הקורסים סימנו כלא רלוונטית. לכל היותר אחת לכל מיומנות.
 */
export function programObservations(recs: AdminRecord[], max = 4): Observation[] {
  const aggs = aggregate(recs);
  const out: (Observation & { pr: number; skill: SkillKey })[] = [];
  for (const a of aggs) {
    const total = a.n + a.na;
    if (!total) continue;
    const cands: (Observation & { pr: number })[] = [];
    if (total >= 2 && a.na / total >= 0.5) {
      cands.push({
        id: `na_${a.key}`, pr: 90,
        title: `${a.name}: סומנה כלא רלוונטית ב-${a.na} מתוך ${total} הקורסים`,
        text: 'כדאי לוודא שיש בתוכנית קורסים שבהם המיומנות נלמדת במכוון, או להחליט במפורש שאינה חלק מפרופיל הבוגר.',
      });
    }
    if (a.practice !== null && a.assessment !== null) {
      const p = a.practice, s = a.assessment;
      if (p < 1.5 && s < 1.5) {
        cands.push({
          id: `absent_${a.key}`, pr: 80,
          title: `${a.name} כמעט אינה מטופלת בתוכנית`,
          text: `גם התרגול (${fmt2(p)}) וגם ההערכה (${fmt2(s)}) נמוכים בממוצע. אם המיומנות חשובה לבוגרי התוכנית, נדרש קורס עוגן שיתרגל ויבדוק אותה.`,
        });
      } else if (p - s >= 1) {
        cands.push({
          id: `unassessed_${a.key}`, pr: 70,
          title: `${a.name} מתורגלת אך כמעט אינה נבדקת`,
          text: `ממוצע התרגול ${fmt2(p)} לעומת הערכה ${fmt2(s)}. הסטודנטים עובדים על המיומנות, אך אין בתוכנית עדות לכך שרכשו אותה. אפשר להוסיף רכיב הערכה ייעודי בקורס אחד או שניים.`,
        });
      } else if (s - p >= 1) {
        cands.push({
          id: `untrained_${a.key}`, pr: 75,
          title: `${a.name} נבדקת יותר משהיא מתורגלת`,
          text: `ממוצע ההערכה ${fmt2(s)} לעומת תרגול ${fmt2(p)}. הסטודנטים נדרשים להפגין מיומנות שלא קיבלו הזדמנות מספקת לתרגל. כדאי להוסיף תרגול מודרך לפני ההערכה.`,
        });
      }
      const strong = recs.filter((r) => { const x = r.skills.find((k) => k.key === a.key)!; return !x.notApplicable && (x.practice ?? 0) >= 3; });
      if (a.n >= 3 && strong.length === 1) {
        cands.push({
          id: `single_${a.key}`, pr: 60,
          title: `${a.name} נשענת על קורס אחד`,
          text: `רק בקורס "${strong[0].course}" המיומנות מתורגלת ברמה גבוהה. פיזור התרגול על פני שנות התואר יחזק את הרצף ויפחית תלות בקורס יחיד.`,
        });
      }
    }
    cands.sort((x, y) => y.pr - x.pr);
    if (cands[0]) out.push({ ...cands[0], skill: a.key });
  }
  out.sort((x, y) => y.pr - x.pr);
  const picked = out.slice(0, max).map(({ id, title, text }) => ({ id, title, text }));
  if (!picked.length && recs.length) {
    picked.push({
      id: 'balanced', title: 'לא נמצאו פערים בולטים',
      text: 'התרגול וההערכה של כל המיומנויות קרובים זה לזה ואף מיומנות אינה חסרה. כדאי לבחון את הפירוט לפי שנים ולפי קורסים כדי לזהות הזדמנויות להעמקה.',
    });
  }
  return picked;
}

/** סדר הקורסים בדוח: לפי שנה בתואר, אחר כך לפי שם הקורס */
export function reportRows(recs: AdminRecord[]): AdminRecord[] {
  return [...recs].sort((a, b) => (a.studyYear ?? 9) - (b.studyYear ?? 9) || a.course.localeCompare(b.course, 'he') || a.lecturer.localeCompare(b.lecturer, 'he'));
}

export const ROWS_PER_PAGE = 28;

export function chunk<T>(xs: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out.length ? out : [[]];
}

/** שם קובץ באותיות לטיניות בלבד: דפדפנים מסוימים מתעלמים משם עברי בהורדה ושומרים "download" */
export function reportFilename(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `skills_report_${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}_${p(date.getHours())}${p(date.getMinutes())}.pdf`;
}
