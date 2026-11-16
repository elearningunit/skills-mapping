// נתוני דוגמה בדויים לתצוגה מקומית של ממשק הרשות (לא נכללים בגרסה שמותקנת ב-Apps Script).
import { SKILLS, type SkillKey } from '../config/questionnaire';
import type { AdminApi } from './api';
import type { Action, AdminData, LogEntry } from './model';

type Ans = Partial<Record<SkillKey, number[]>>; // חסר = "לא רלוונטי"

function row(p: {
  id: string; created: string; faculty?: string; department: string; ay: string; year: number;
  course: string; lecturer: string; ans: Ans; status: 'valid' | 'flagged' | 'excluded'; flags?: string; decision?: string; subs?: number;
}): Record<string, unknown> {
  const r: Record<string, unknown> = {
    received_at: p.created, created_at: p.created, assessment_id: p.id,
    faculty: p.faculty ?? 'הפקולטה למדעי הבריאות', department: p.department, study_year: p.year,
    lecturer_name: p.lecturer, course_name: p.course, assessment_date: p.created.slice(0, 10),
    questionnaire_version: '0.5', academic_year: p.ay,
    submissions: p.subs ?? 1, status: p.status, flags: p.flags ?? '', dup_key: '', decision: p.decision ?? '',
  };
  for (const s of SKILLS) {
    const a = p.ans[s.key];
    s.items.forEach((i, n) => { r[i.code] = a ? a[n] : ''; });
    r[`${s.key}_P`] = a ? (a[0] + a[1] + a[2] + a[3]) / 4 : '';
    r[`${s.key}_A`] = a ? a[4] : '';
    r[`${s.key}_status`] = a ? 'answered' : 'not_applicable';
  }
  return r;
}

const id = (n: number) => `d0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export function demoApi(): AdminApi {
  const rows = [
    row({ id: id(1), created: '2026-11-16T08:42:00.000Z', department: 'סיעוד', ay: 'תשפ״ז', year: 1, course: 'יסודות הסיעוד', lecturer: 'ד"ר נועה לוי (דוגמה)', status: 'valid', subs: 2,
      ans: { T: [3, 4, 3, 3, 1], C: [3, 2, 3, 2, 0], R: [2, 2, 1, 2, 2], H: [3, 3, 3, 3, 2] } }),
    row({ id: id(2), created: '2026-11-16T09:10:00.000Z', department: 'סיעוד', ay: 'תשפ״ז', year: 1, course: 'יסודות הסיעוד', lecturer: 'נועה לוי (דוגמה)', status: 'flagged', flags: `possible_duplicate:${id(1)}`,
      ans: { T: [3, 3, 3, 3, 1], C: [2, 3, 2, 2, 0], R: [1, 2, 2, 1, 2], H: [3, 3, 3, 3, 1] } }),
    row({ id: id(3), created: '2026-11-15T12:00:00.000Z', department: 'סיעוד', ay: 'תשפ״ז', year: 1, course: 'יסודות הסיעוד', lecturer: 'פרופ׳ אבי כהן (דוגמה)', status: 'valid',
      ans: { T: [1, 1, 1, 1, 1], C: [2, 2, 2, 2, 2], H: [3, 2, 3, 2, 3] } }),
    row({ id: id(4), created: '2026-11-15T10:00:00.000Z', department: 'סיעוד', ay: 'תשפ״ז', year: 2, course: 'פרמקולוגיה', lecturer: 'ד"ר רות מזרחי (דוגמה)', status: 'valid',
      ans: { T: [2, 2, 2, 2, 3], C: [4, 3, 4, 3, 4], R: [1, 0, 1, 0, 0], H: [1, 1, 1, 1, 0] } }),
    row({ id: id(5), created: '2026-11-14T14:30:00.000Z', department: 'סיעוד', ay: 'תשפ״ז', year: 3, course: 'סיעוד קהילתי', lecturer: 'ד"ר יעל אברהם (דוגמה)', status: 'valid',
      ans: { T: [4, 4, 3, 4, 3], C: [3, 3, 3, 3, 2], R: [3, 3, 2, 3, 1], H: [4, 3, 4, 3, 2] } }),
    row({ id: id(6), created: '2026-11-14T09:00:00.000Z', faculty: 'הפקולטה להנדסה', department: 'סיעוד', ay: 'תשפ״ז', year: 2, course: 'קורס לדוגמה', lecturer: 'מרצה לדוגמה', status: 'flagged', flags: 'unknown_unit',
      ans: { T: [2, 2, 2, 2, 2], C: [2, 2, 2, 2, 2], R: [2, 2, 2, 2, 2], H: [2, 2, 2, 2, 2] } }),
    row({ id: id(7), created: '2026-11-13T11:00:00.000Z', department: 'ריפוי בעיסוק', ay: 'תשפ״ו', year: 4, course: 'סמינר מחקר', lecturer: 'ד"ר עמית שמש (דוגמה)', status: 'excluded', decision: 'excluded',
      ans: { T: [4, 4, 4, 4, 4], C: [4, 4, 3, 4, 3], R: [2, 2, 2, 2, 1], H: [3, 3, 3, 3, 3] } }),
  ];
  const log: LogEntry[] = rows.map((r) => ({ time: String(r.created_at), actor: 'collector', action: 'received', assessment_id: String(r.assessment_id), details: '' }));
  log.push({ time: '2026-11-13T12:00:00.000Z', actor: 'elearningunit@g.ariel.ac.il', action: 'excluded', assessment_id: id(7), details: 'דיווח ניסיון' });

  const decide = (r: Record<string, unknown>, decision: string) => {
    r.decision = decision;
    r.status = decision === 'excluded' ? 'excluded' : decision === 'included' ? 'valid' : r.flags ? 'flagged' : 'valid';
  };
  return {
    async listMappings(): Promise<AdminData> {
      return structuredClone({ me: 'elearningunit@g.ariel.ac.il (דוגמה)', rows, log, loadedAt: new Date().toISOString() });
    },
    async setDecision(target: string, action: Action, note: string) {
      const r = rows.find((x) => x.assessment_id === target)!;
      const now = new Date().toISOString();
      if (action === 'replace_previous') {
        decide(r, 'included');
        for (const f of String(r.flags).split(' ').filter((x) => x.startsWith('possible_duplicate:'))) {
          const o = rows.find((x) => x.assessment_id === f.split(':')[1]);
          if (o) { decide(o, 'excluded'); log.push({ time: now, actor: 'elearningunit@g.ariel.ac.il', action: 'excluded', assessment_id: String(o.assessment_id), details: `הוחלף בדיווח ${target}` }); }
        }
      } else decide(r, action === 'include' ? 'included' : action === 'exclude' ? 'excluded' : '');
      log.push({ time: now, actor: 'elearningunit@g.ariel.ac.il', action: action === 'replace_previous' ? 'included_replacing' : action === 'reset' ? 'reset' : `${action}d`, assessment_id: target, details: note });
      return { ok: true };
    },
  };
}
