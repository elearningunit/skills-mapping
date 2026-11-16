import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { CSV_COLUMNS } from '../src/lib/csv';
import { buildPayload, submitMapping } from '../src/lib/submit';
import { UNIT_PAIRS } from '../src/config/units';
import type { Answers, Mapping } from '../src/lib/types';
import { fill, mapping } from './helpers';

const isDate = (x: unknown) => Object.prototype.toString.call(x) === '[object Date]';

/**
 * גיליון מדומה שמתנהג כמו Google Sheets בנקודות הרלוונטיות:
 * גרש בתחילת טקסט = "שמור כטקסט" (והגרש אינו נשמר); YYYY-MM-DD הופך לתאריך; טקסט מספרי הופך למספר.
 */
function fakeSheet() {
  const rows: unknown[][] = [];
  const coerce = (v: unknown) => {
    if (typeof v !== 'string') return v;
    if (v.startsWith("'")) return v.slice(1);
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(`${v}T00:00:00`);
    if (v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
    return v;
  };
  return {
    rows,
    getLastRow: () => rows.length,
    getLastColumn: () => (rows[0] ? rows[0].length : 0),
    setFrozenRows: () => {},
    getRange: (r: number, c: number, nr: number, nc: number) => ({
      setValues: (v: unknown[][]) => {
        v.forEach((row, i) => {
          const target = (rows[r - 1 + i] ||= []);
          row.forEach((cell, j) => { target[c - 1 + j] = coerce(cell); });
        });
      },
      getValues: () =>
        Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => rows[r - 1 + i]?.[c - 1 + j] ?? '')),
    }),
  };
}

function loadCollector(opts: { email?: string; mailFails?: boolean } = {}) {
  const sheets: Record<string, ReturnType<typeof fakeSheet>> = {};
  const sheetFor = (name: string) => (sheets[name] ||= fakeSheet());
  const mails: { to: string; subject: string; body: string }[] = [];
  const cache = new Map<string, string>();
  const ctx: Record<string, unknown> = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: (n: string) => sheets[n] ?? null,
        insertSheet: (n: string) => sheetFor(n),
        getUrl: () => 'https://docs.google.com/spreadsheets/d/X',
      }),
    },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    CacheService: {
      getScriptCache: () => ({ get: (k: string) => cache.get(k) ?? null, put: (k: string, v: string) => { cache.set(k, v); } }),
    },
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: (k: string) => (k === 'NOTIFY_EMAIL' ? opts.email ?? null : null) }),
    },
    MailApp: {
      sendEmail: (m: { to: string; subject: string; body: string }) => {
        if (opts.mailFails) throw new Error('quota');
        mails.push(m);
      },
    },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (t: string) => ({ setMimeType: () => ({ text: t }) }) },
    console: { error: () => {} },
  };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(new URL('../collector/Code.gs', import.meta.url), 'utf8'), ctx);
  const post = (body: unknown) => {
    const res = JSON.parse((ctx.doPost as (e: unknown) => { text: string })({ postData: { contents: JSON.stringify(body) } }).text);
    cache.clear(); // כל שליחה בבדיקות "אחרי" חלון הגבלת הקצב, אלא אם בודקים את ההגבלה עצמה
    return res;
  };
  const postRaw = (contents: string) =>
    JSON.parse((ctx.doPost as (e: unknown) => { text: string })({ postData: { contents } }).text);
  const header = ctx.HEADER as string[];
  const data = () => (sheets['מיפויים']?.rows ?? []);
  const rec = (i = 1) => Object.fromEntries(header.map((h, j) => [h, data()[i]?.[j]]));
  const log = () => (sheets['יומן']?.rows ?? []);
  return { ctx, sheets, data, rec, log, post, postRaw, mails, cache, header };
}

const withoutSkill = (a: Answers, k: string) =>
  Object.fromEntries(Object.entries(a).filter(([c]) => !c.startsWith(k))) as Answers;
const ID2 = '11111111-2222-4333-8444-555555555555';
const ID3 = '22222222-3333-4444-8555-666666666666';

describe('קולט v2: מבנה', () => {
  it('העמודות זהות ל-CSV של האתר, ועמודות הניהול בסוף', () => {
    const { ctx, header } = loadCollector();
    expect(ctx.CSV_COLUMNS).toEqual(CSV_COLUMNS);
    expect(header).toEqual(['received_at', ...CSV_COLUMNS, 'created_at', 'submissions', 'status', 'flags', 'dup_key', 'decision']);
  });

  it('רשימת הפקולטות והמחלקות בקולט זהה לרשימת האתר (מקור אמת אחד)', () => {
    const { ctx } = loadCollector();
    const fromSite: Record<string, string[]> = {};
    for (const p of UNIT_PAIRS) (fromSite[p.faculty] ||= []).push(p.department);
    expect(JSON.parse(JSON.stringify(ctx.UNITS))).toEqual(fromSite);
  });
});

describe('קולט v2: קליטה תקינה', () => {
  it('מיפוי תקין נשמר אוטומטית בסטטוס valid, עם זמן יצירה ורישום ביומן', () => {
    const { post, rec, log } = loadCollector();
    expect(post(buildPayload(mapping(fill(3, { T1: 1 }))))).toEqual({ ok: true, updated: false });
    const r = rec();
    expect(r.status).toBe('valid');
    expect(r.flags).toBe('');
    expect(r.submissions).toBe(1);
    expect(isDate(r.created_at)).toBe(true);
    expect([r.lecturer_name, r.T1, r.T_P, r.H_status, r.academic_year]).toEqual(['ד"ר ישראלה ישראלי', 1, 2.5, 'answered', 'תשפ״ז']);
    expect(log()[0]).toEqual(['time', 'actor', 'action', 'assessment_id', 'details']);
    expect(log()[1].slice(1, 4)).toEqual(['collector', 'received', r.assessment_id]);
  });

  it('תאריך המיפוי והגרסה נשמרים כטקסט, ולא מומרים לתאריך או למספר', () => {
    const { post, rec } = loadCollector();
    post(buildPayload(mapping(fill(2))));
    expect(rec().assessment_date).toBe('2026-11-12');
    expect(rec().questionnaire_version).toBe('0.5');
  });

  it('שליחה חוזרת: מעדכנת את אותה שורה; זמן היצירה אינו משתנה; מונה השליחות עולה', () => {
    const { post, rec, data, log } = loadCollector();
    const m = mapping(fill(2));
    post(buildPayload(m));
    const created = rec().created_at;
    expect(post(buildPayload({ ...m, answers: fill(4) }))).toEqual({ ok: true, updated: true });
    expect(data()).toHaveLength(2);
    expect(rec().created_at).toBe(created);
    expect(rec().submissions).toBe(2);
    expect(rec().T1).toBe(4);
    expect(log()[2][2]).toBe('updated');
  });

  it('מיומנות "לא רלוונטית": תאים ריקים, סטטוס not_applicable, והדיווח תקין', () => {
    const { post, rec } = loadCollector();
    post(buildPayload({ ...mapping(fill(2)), answers: withoutSkill(fill(2), 'C'), not_applicable: ['C'] }));
    expect([rec().C1, rec().C_P, rec().C_A, rec().C_status, rec().status]).toEqual(['', '', '', 'not_applicable', 'valid']);
  });

  it('הציונים מחושבים מחדש בשרת; ציון שנשלח ואינו תואם מסומן', () => {
    const { post, rec } = loadCollector();
    const row = { ...buildPayload(mapping(fill(2))).row, T_P: '3.75' };
    post({ row });
    expect(rec().T_P).toBe(2);
    expect(rec().status).toBe('flagged');
    expect(rec().flags).toContain('score_mismatch_T');
  });
});

describe('קולט v2: שמירה וסימון במקום דחייה', () => {
  it('שיוך פקולטה–מחלקה שאינו ברשימה נשמר ומסומן unknown_unit', () => {
    const { post, rec } = loadCollector();
    expect(post(buildPayload(mapping(fill(2), { faculty: 'הפקולטה להנדסה', department: 'סיעוד' }))).ok).toBe(true);
    expect([rec().status, rec().flags, rec().department]).toEqual(['flagged', 'unknown_unit', 'סיעוד']);
  });

  it('ערך חריג נשמר כמקור ומסומן; לא נספר', () => {
    const { post, rec } = loadCollector();
    post({ row: { ...buildPayload(mapping(fill(2))).row, T1: 7, study_year: 9 } });
    expect(rec().status).toBe('flagged');
    expect(String(rec().flags).split(' ').sort()).toEqual(['invalid_T1', 'invalid_study_year']);
    expect([rec().T1, rec().study_year, rec().T_P]).toEqual([7, 9, '']);
  });

  it('מיפוי בלי שנה אקדמית (גרסה ישנה של האתר) נשמר ומסומן', () => {
    const { post, rec } = loadCollector();
    const row = { ...buildPayload(mapping(fill(2))).row } as Record<string, unknown>;
    delete row.academic_year;
    expect(post({ row }).ok).toBe(true);
    expect([rec().status, rec().flags]).toEqual(['flagged', 'missing_academic_year']);
  });

  it('נדחית רק בקשה שאינה מיפוי: JSON שבור, בלי שורה, מזהה לא תקין, גוף גדול מדי', () => {
    const { post, postRaw, data } = loadCollector();
    expect(postRaw('not json')).toEqual({ ok: false, error: 'bad_json' });
    expect(post({})).toEqual({ ok: false, error: 'no_row' });
    expect(post({ row: { ...buildPayload(mapping(fill(2))).row, assessment_id: 'x' } })).toEqual({ ok: false, error: 'bad_id' });
    expect(postRaw(JSON.stringify({ row: { ...buildPayload(mapping(fill(2))).row, course_name: 'א'.repeat(25000) } }))).toEqual({ ok: false, error: 'too_large' });
    expect(data().length).toBeLessThanOrEqual(1);
  });

  it('טקסט שמתחיל בסימן נוסחה נשמר כטקסט', () => {
    const { post, rec } = loadCollector();
    post({ row: { ...buildPayload(mapping(fill(2))).row, course_name: '=IMPORTXML("x")' } });
    expect(rec().course_name).toBe('=IMPORTXML("x")'); // נשמר כטקסט (הגרש אינו חלק מהערך)
  });
});

describe('קולט v2: כפילות לוגית', () => {
  const base = (over: Partial<Mapping> = {}, details: Partial<Mapping['details']> = {}) =>
    ({ ...mapping(fill(2), details), ...over }) as Mapping;

  it('אותו מרצה, קורס, מחלקה ושנים במזהה אחר: מסומן possible_duplicate ואינו נספר', () => {
    const { post, rec } = loadCollector();
    const first = base();
    post(buildPayload(first));
    // אותו מרצה בכתיב מעט שונה: תואר, רווחים ומירכאות
    post(buildPayload(base({ assessment_id: ID2 }, { lecturer_name: 'ד״ר  ישראלה   ישראלי' })));
    expect(rec(1).status).toBe('valid');
    expect(rec(2).status).toBe('flagged');
    expect(rec(2).flags).toBe(`possible_duplicate:${first.assessment_id}`);
  });

  it('מרצה אחר באותו קורס אינו כפילות', () => {
    const { post, rec } = loadCollector();
    post(buildPayload(base()));
    post(buildPayload(base({ assessment_id: ID2 }, { lecturer_name: 'פרופ׳ משה כהן' })));
    expect(rec(2).status).toBe('valid');
  });

  it('אותו קורס בשנה אקדמית אחרת אינו כפילות', () => {
    const { post, rec } = loadCollector();
    post(buildPayload(base()));
    post(buildPayload(base({ assessment_id: ID2 }, { academic_year: 'תשפ״ח' })));
    expect(rec(2).status).toBe('valid');
  });

  it('החלטת הרשות (הכללה/החרגה) נשמרת גם כשהמרצה שולח שוב', () => {
    const { post, rec, data, header } = loadCollector();
    post(buildPayload(base()));
    const dup = base({ assessment_id: ID2 }, { lecturer_name: 'ד"ר ישראלה ישראלי' });
    post(buildPayload(dup));
    expect(rec(2).status).toBe('flagged');
    data()[2][header.indexOf('decision')] = 'included'; // כמו שממשק הרשות יעשה
    post(buildPayload(dup));
    expect([rec(2).status, rec(2).decision]).toEqual(['valid', 'included']);
    data()[2][header.indexOf('decision')] = 'excluded';
    post(buildPayload(dup));
    expect(rec(2).status).toBe('excluded');
    post(buildPayload({ ...dup, assessment_id: ID3 }));
    expect(rec(3).flags).toContain('possible_duplicate'); // הדיווח הראשון עדיין תקין
  });
});

describe('קולט v2: הגנה מהצפה ומבוטים', () => {
  it('שדה נסתר שמולא: מוחזר "אישור" ודבר אינו נשמר', () => {
    const { post, data } = loadCollector();
    expect(post({ ...buildPayload(mapping(fill(2))), hp: 'http://spam' })).toEqual({ ok: true });
    expect(data()).toHaveLength(0);
  });

  it('אותו מיפוי פעמיים ברצף מהיר: השנייה נדחית too_fast', () => {
    const { ctx, data } = loadCollector();
    const send = () => JSON.parse((ctx.doPost as (e: unknown) => { text: string })({ postData: { contents: JSON.stringify(buildPayload(mapping(fill(2)))) } }).text);
    expect(send().ok).toBe(true);
    expect(send()).toEqual({ ok: false, error: 'too_fast' });
    expect(data()).toHaveLength(2);
  });

  it('יותר מ-60 שליחות בדקה: נדחות busy', () => {
    const { ctx } = loadCollector();
    const results: string[] = [];
    for (let i = 0; i < 61; i++) {
      const id = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
      const res = JSON.parse((ctx.doPost as (e: unknown) => { text: string })({ postData: { contents: JSON.stringify(buildPayload({ ...mapping(fill(2)), assessment_id: id })) } }).text);
      results.push(res.ok ? 'ok' : res.error);
    }
    expect(results.filter((r) => r === 'ok')).toHaveLength(60);
    expect(results[60]).toBe('busy');
  });
});

describe('קולט v2: הסבת נתונים מגרסה 1', () => {
  it('שורות קיימות מקבלות עמודות ניהול; כפילות בין שורות קיימות מסומנת; הרצה חוזרת אינה משנה', () => {
    const { ctx, sheets, rec, data } = loadCollector();
    // גיליון של גרסה 1: כותרת של 42 עמודות ושתי שורות (השנייה כפולה), עם תאריך שהגיליון המיר
    (ctx.SpreadsheetApp as { getActiveSpreadsheet: () => { insertSheet: (n: string) => unknown } }).getActiveSpreadsheet().insertSheet('מיפויים');
    const s = sheets['מיפויים'];
    const v1Row = (id: string, t: Date) => {
      const row = buildPayload({ ...mapping(fill(2)), assessment_id: id }).row;
      return [t, ...CSV_COLUMNS.map((c) => (c === 'assessment_date' ? new Date('2026-11-12T00:00:00') : row[c]))];
    };
    s.rows.push(['received_at', ...CSV_COLUMNS]);
    s.rows.push(v1Row(ID2, new Date('2026-11-16T10:00:00')));
    s.rows.push(v1Row(ID3, new Date('2026-11-16T11:00:00')));
    expect((ctx.migrate as () => number)()).toBe(2);
    expect(data()[0]).toEqual(ctx.HEADER);
    expect([rec(1).status, rec(1).assessment_date, rec(1).submissions]).toEqual(['valid', '2026-11-12', 1]);
    expect(rec(1).created_at).toEqual(new Date('2026-11-16T10:00:00'));
    expect([rec(2).status, rec(2).flags]).toEqual(['flagged', `possible_duplicate:${ID2}`]);
    expect((ctx.migrate as () => number)()).toBe(0);
  });
});

describe('קולט v2: הודעות מייל', () => {
  it('הכתובת נקראת ממאפייני הסקריפט; בגרסה הציבורית אין כתובת בקוד', () => {
    const { ctx, mails, post } = loadCollector();
    expect(ctx.NOTIFY_EMAIL).toBe('');
    post(buildPayload(mapping(fill(2))));
    expect(mails).toHaveLength(0);
  });

  it('מייל על מיפוי חדש, עדכון ומיפוי לבדיקה — בלי שם המרצה', () => {
    const { mails, post } = loadCollector({ email: 'team@example.test' });
    const m = mapping(fill(2));
    post(buildPayload(m));
    post(buildPayload(m));
    post(buildPayload(mapping(fill(2), { faculty: 'הפקולטה להנדסה', department: 'סיעוד' })));
    expect(mails.map((x) => x.subject)).toEqual([
      'מיפוי חדש התקבל: מבוא לריפוי בעיסוק',
      'מיפוי עודכן: מבוא לריפוי בעיסוק',
      'מיפוי עודכן: מבוא לריפוי בעיסוק (לבדיקה)',
    ]);
    expect(mails[0].to).toBe('team@example.test');
    expect(mails[0].body).toContain('שנה אקדמית: תשפ״ז');
    expect(mails[0].body).toContain('תאריך מיפוי: 2026-11-12');
    expect(mails[2].body).toContain('unknown_unit');
    expect(mails.every((x) => !x.body.includes('ישראלי'))).toBe(true);
  });

  it('כשל בשליחת מייל אינו מונע את שמירת המיפוי', () => {
    const { data, post } = loadCollector({ email: 'team@example.test', mailFails: true });
    expect(post(buildPayload(mapping(fill(2)))).ok).toBe(true);
    expect(data()).toHaveLength(2);
  });
});

describe('שליחה מהאתר', () => {
  it('שולח POST כ-text/plain עם שורת ה-CSV ושדה נסתר ריק, ומחזיר ok', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ ok: true })));
    expect(await submitMapping('https://example.test/exec', mapping(fill(1)), f as unknown as typeof fetch)).toBe('ok');
    const [, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toContain('text/plain');
    const body = JSON.parse(init.body as string);
    expect(Object.keys(body.row)).toEqual(CSV_COLUMNS);
    expect(body.hp).toBe('');
  });
  it('שליחה מהירה מדי מזוהה; דחייה מהקולט: rejected; כשל רשת: failed', async () => {
    const fast = vi.fn(async () => new Response(JSON.stringify({ ok: false, error: 'too_fast' })));
    expect(await submitMapping('u', mapping(fill(1)), fast as unknown as typeof fetch)).toBe('too_fast');
    const rej = vi.fn(async () => new Response(JSON.stringify({ ok: false, error: 'bad_id' })));
    expect(await submitMapping('u', mapping(fill(1)), rej as unknown as typeof fetch)).toBe('rejected');
    const down = vi.fn(async () => { throw new TypeError('network'); });
    expect(await submitMapping('u', mapping(fill(1)), down as unknown as typeof fetch)).toBe('failed');
  });
});
