// בדיקות צד השרת של ממשק הרשות (admin/Code.gs): הרשאות, קריאה, הכרעות ויומן.
// הקולט והממשק רצים על אותו גיליון מדומה, כמו בפועל.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { buildPayload } from '../src/lib/submit';
import { toRecord } from '../src/admin/model';
import { fill, mapping } from './helpers';

/** גיליון מדומה (כמו בבדיקות הקולט): גרש = טקסט; YYYY-MM-DD → תאריך; טקסט מספרי → מספר */
function fakeSpreadsheet() {
  const sheets: Record<string, unknown[][]> = {};
  const coerce = (v: unknown) => {
    if (typeof v !== 'string') return v;
    if (v.startsWith("'")) return v.slice(1);
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(`${v}T00:00:00`);
    if (v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
    return v;
  };
  const sheet = (name: string) => {
    const rows = (sheets[name] ||= []);
    return {
      getLastRow: () => rows.length,
      getLastColumn: () => (rows[0] ? rows[0].length : 0),
      setFrozenRows: () => {},
      getRange: (r: number, c: number, nr: number, nc: number) => ({
        setValues: (v: unknown[][]) => v.forEach((row, i) => { const t = (rows[r - 1 + i] ||= []); row.forEach((x, j) => { t[c - 1 + j] = coerce(x); }); }),
        getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => rows[r - 1 + i]?.[c - 1 + j] ?? '')),
      }),
    };
  };
  const ss = {
    getSheetByName: (n: string) => (sheets[n] ? sheet(n) : null),
    insertSheet: (n: string) => sheet(n),
    getUrl: () => '#',
  };
  return { sheets, ss };
}

const common = () => ({
  LockService: { getScriptLock: () => ({ waitLock: () => {}, tryLock: () => true, releaseLock: () => {} }) },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (t: string) => ({ setMimeType: () => ({ text: t }) }) },
  console: { error: () => {} },
});

function loadCollector(ss: unknown) {
  const cache = new Map<string, string>();
  const ctx: Record<string, unknown> = {
    ...common(),
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    CacheService: { getScriptCache: () => ({ get: (k: string) => cache.get(k) ?? null, put: (k: string, v: string) => cache.set(k, v) }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) },
    MailApp: { sendEmail: () => {} },
  };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(new URL('../collector/Code.gs', import.meta.url), 'utf8'), ctx);
  return (body: unknown) => {
    (ctx.doPost as (e: unknown) => unknown)({ postData: { contents: JSON.stringify(body) } });
    cache.clear();
  };
}

function loadAdmin(ss: unknown, opts: { email?: string; admins?: string | null; sheetId?: string | null } = {}) {
  const props: Record<string, string | null> = {
    ADMIN_EMAILS: opts.admins === undefined ? 'elearningunit@g.ariel.ac.il' : opts.admins,
    SHEET_ID: opts.sheetId === undefined ? 'SHEET' : opts.sheetId,
  };
  const served: string[] = [];
  const ctx: Record<string, unknown> = {
    ...common(),
    Session: { getActiveUser: () => ({ getEmail: () => opts.email ?? 'elearningunit@g.ariel.ac.il' }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k: string) => props[k] ?? null }) },
    SpreadsheetApp: { openById: (id: string) => { if (id !== 'SHEET') throw new Error('not found'); return ss; } },
    HtmlService: {
      createHtmlOutputFromFile: (f: string) => { served.push(`file:${f}`); const o = { setTitle: () => o, addMetaTag: () => o }; return o; },
      createHtmlOutput: (h: string) => { served.push(h); const o = { setTitle: () => o }; return o; },
    },
  };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(new URL('../admin/Code.gs', import.meta.url), 'utf8'), ctx);
  const fn = <T,>(name: string, ...args: unknown[]) => (ctx[name] as (...a: unknown[]) => T)(...args);
  return { ctx, served, fn };
}

const ID2 = '11111111-2222-4333-8444-555555555555';
const ID3 = '22222222-3333-4444-8555-666666666666';

/** גיליון עם שלושה דיווחים: תקין, כפילות שלו, ושיוך לא מוכר */
function seeded() {
  const { sheets, ss } = fakeSpreadsheet();
  const post = loadCollector(ss);
  const first = mapping(fill(2));
  post(buildPayload(first));
  post(buildPayload({ ...first, assessment_id: ID2, details: { ...first.details, lecturer_name: 'ישראלה ישראלי' } }));
  post(buildPayload({ ...mapping(fill(3), { faculty: 'הפקולטה להנדסה', department: 'סיעוד' }), assessment_id: ID3 }));
  return { sheets, ss, post, firstId: first.assessment_id };
}

type Listed = { me: string; rows: Record<string, unknown>[]; log: { action: string; assessment_id: string; actor: string; details: string }[] };

describe('ממשק הרשות – הרשאות', () => {
  it('משתמש מורשה מקבל את המסך; לא מורשה מקבל הודעת "אין הרשאה" בלבד', () => {
    const { ss } = seeded();
    const ok = loadAdmin(ss);
    ok.fn('doGet');
    expect(ok.served).toEqual(['file:index']);
    const no = loadAdmin(ss, { email: 'someone@g.ariel.ac.il' });
    no.fn('doGet');
    expect(no.served).toHaveLength(1);
    expect(no.served[0]).toContain('אין הרשאה');
    expect(no.served[0]).not.toContain('ישראלי');
  });

  it('לא מורשה אינו יכול לקרוא נתונים או להכריע דרך הפונקציות', () => {
    const { ss, sheets, firstId } = seeded();
    const before = JSON.stringify(sheets['מיפויים']);
    const no = loadAdmin(ss, { email: 'stranger@gmail.com' });
    expect(() => no.fn('listMappings')).toThrow('אין הרשאה');
    expect(() => no.fn('setDecision', firstId, 'exclude', '')).toThrow('אין הרשאה');
    expect(JSON.stringify(sheets['מיפויים'])).toBe(before);
  });

  it('בלי רשימת מורשים, או בלי משתמש מזוהה — אף אחד אינו מורשה', () => {
    const { ss } = seeded();
    expect(() => loadAdmin(ss, { admins: null }).fn('listMappings')).toThrow('אין הרשאה');
    expect(() => loadAdmin(ss, { email: '' }).fn('listMappings')).toThrow('אין הרשאה');
  });

  it('השוואת כתובות אינה תלויה באותיות גדולות/קטנות ובמרווחים; כמה מורשים מופרדים בפסיק', () => {
    const { ss } = seeded();
    const a = loadAdmin(ss, { email: 'ELearningUnit@G.Ariel.ac.il', admins: ' other@x.org , elearningunit@g.ariel.ac.il ' });
    expect(a.fn<Listed>('listMappings').rows).toHaveLength(3);
  });

  it('בלי SHEET_ID: הודעה ברורה', () => {
    const { ss } = seeded();
    expect(() => loadAdmin(ss, { sheetId: null }).fn('listMappings')).toThrow('SHEET_ID');
  });
});

describe('ממשק הרשות – קריאה', () => {
  it('מחזיר את כל הדיווחים, תאריכים כטקסט ISO, ואת היומן', () => {
    const { ss, firstId } = seeded();
    const data = loadAdmin(ss).fn<Listed>('listMappings');
    expect(data.me).toBe('elearningunit@g.ariel.ac.il');
    expect(data.rows.map((r) => r.status)).toEqual(['valid', 'flagged', 'flagged']);
    expect(typeof data.rows[0].created_at).toBe('string');
    expect(String(data.rows[0].created_at)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(data.log.map((l) => l.action)).toEqual(['received', 'received', 'received']);
    const recs = data.rows.map(toRecord);
    expect(recs[0]).toMatchObject({ id: firstId, status: 'valid', assessmentDate: '2026-11-12', academicYear: 'תשפ״ז' });
    expect(recs[1].flags).toEqual([`possible_duplicate:${firstId}`]);
    expect(recs[2].flags).toEqual(['unknown_unit']);
  });
});

describe('ממשק הרשות – הכרעות', () => {
  it('החרגה והכללה משנות רק decision ו-status, ונרשמות ביומן עם כתובת המבצע', () => {
    const { ss, sheets } = seeded();
    const a = loadAdmin(ss);
    const header = sheets['מיפויים'][0] as string[];
    const others = (row: unknown[]) => row.filter((_, i) => !['decision', 'status'].includes(header[i]));
    const before = others(sheets['מיפויים'][3]);
    a.fn('setDecision', ID3, 'include', 'השיוך נבדק ותקין');
    let rec = toRecord(a.fn<Listed>('listMappings').rows[2]);
    expect([rec.status, rec.decision]).toEqual(['valid', 'included']);
    expect(others(sheets['מיפויים'][3])).toEqual(before); // הנתונים המקוריים לא השתנו
    a.fn('setDecision', ID3, 'exclude', '');
    rec = toRecord(a.fn<Listed>('listMappings').rows[2]);
    expect([rec.status, rec.decision]).toEqual(['excluded', 'excluded']);
    a.fn('setDecision', ID3, 'reset', '');
    rec = toRecord(a.fn<Listed>('listMappings').rows[2]);
    expect([rec.status, rec.decision]).toEqual(['flagged', '']); // חזר לסימון המקורי
    const log = a.fn<Listed>('listMappings').log.filter((l) => l.assessment_id === ID3);
    expect(log.map((l) => l.action)).toEqual(['received', 'included', 'excluded', 'reset']);
    expect(log[1]).toMatchObject({ actor: 'elearningunit@g.ariel.ac.il', details: 'השיוך נבדק ותקין' });
  });

  it('"מחליף את הקודם": הדיווח החדש נכלל והקודם מוחרג; שני הצעדים ביומן', () => {
    const { ss, firstId } = seeded();
    const a = loadAdmin(ss);
    a.fn('setDecision', ID2, 'replace_previous', '');
    const data = a.fn<Listed>('listMappings');
    const recs = data.rows.map(toRecord);
    expect(recs.find((r) => r.id === ID2)).toMatchObject({ status: 'valid', decision: 'included' });
    expect(recs.find((r) => r.id === firstId)).toMatchObject({ status: 'excluded', decision: 'excluded' });
    expect(data.log.find((l) => l.assessment_id === firstId && l.action === 'excluded')?.details).toContain(ID2);
    expect(data.log.find((l) => l.assessment_id === ID2 && l.action === 'included_replacing')).toBeTruthy();
  });

  it('הכרעת הרשות נשמרת גם כשהמרצה שולח שוב', () => {
    const { ss, post } = seeded();
    const a = loadAdmin(ss);
    a.fn('setDecision', ID3, 'exclude', '');
    post(buildPayload({ ...mapping(fill(4), { faculty: 'הפקולטה להנדסה', department: 'סיעוד' }), assessment_id: ID3 }));
    const rec = toRecord(a.fn<Listed>('listMappings').rows[2]);
    expect([rec.status, rec.decision, rec.submissions]).toEqual(['excluded', 'excluded', 2]);
  });

  it('קלט שגוי נדחה: פעולה לא מוכרת, מזהה לא קיים, החלפה בלי כפילות', () => {
    const { ss, firstId } = seeded();
    const a = loadAdmin(ss);
    expect(() => a.fn('setDecision', firstId, 'delete', '')).toThrow('פעולה לא מוכרת');
    expect(() => a.fn('setDecision', 'nope', 'exclude', '')).toThrow('הדיווח לא נמצא');
    expect(() => a.fn('setDecision', firstId, 'replace_previous', '')).toThrow('אין כפילות');
  });

  it('גיליון שלא שודרג לקולט 2: הכרעה נכשלת עם הסבר מה לעשות', () => {
    const { sheets, ss } = fakeSpreadsheet();
    sheets['מיפויים'] = [['received_at', 'assessment_id'], [new Date(), ID2]];
    expect(() => loadAdmin(ss).fn('setDecision', ID2, 'exclude', '')).toThrow('migrate');
    expect(toRecord(loadAdmin(ss).fn<Listed>('listMappings').rows[0]).flags).toContain('not_migrated');
  });
});
