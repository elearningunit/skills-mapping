import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { CSV_COLUMNS } from '../src/lib/csv';
import { buildPayload, submitMapping } from '../src/lib/submit';
import type { Answers } from '../src/lib/types';
import { fill, mapping } from './helpers';

/** מריץ את Code.gs עם גיליון מדומה */
function loadCollector(opts: { email?: string; mailFails?: boolean } = {}) {
  const rows: unknown[][] = [];
  const mails: { to: string; subject: string; body: string }[] = [];
  const sheet = {
    getLastRow: () => rows.length,
    getLastColumn: () => (rows[0] ? rows[0].length : 0),
    setFrozenRows: () => {},
    getRange: (r: number, c: number, nr: number, nc: number) => ({
      setValues: (v: unknown[][]) => { v.forEach((row, i) => { rows[r - 1 + i] = row; }); },
      getValues: () => rows.slice(r - 1, r - 1 + nr).map((row) => row.slice(c - 1, c - 1 + nc)),
    }),
  };
  const ctx: Record<string, unknown> = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({ getSheetByName: () => sheet, insertSheet: () => sheet, getUrl: () => 'https://docs.google.com/spreadsheets/d/X' }),
    },
    MailApp: {
      sendEmail: (m: { to: string; subject: string; body: string }) => {
        if (opts.mailFails) throw new Error('quota');
        mails.push(m);
      },
    },
    console: { error: () => {} },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (t: string) => ({ setMimeType: () => ({ text: t }) }),
    },
  };
  vm.createContext(ctx);
  let code = readFileSync(new URL('../collector/Code.gs', import.meta.url), 'utf8');
  if (opts.email) code = code.replace("var NOTIFY_EMAIL = '';", `var NOTIFY_EMAIL = '${opts.email}';`);
  vm.runInContext(code, ctx);
  const post = (body: unknown) =>
    JSON.parse((ctx.doPost as (e: unknown) => { text: string })({ postData: { contents: JSON.stringify(body) } }).text);
  return { ctx, rows, post, mails };
}

const withoutSkill = (a: Answers, k: string) =>
  Object.fromEntries(Object.entries(a).filter(([c]) => !c.startsWith(k))) as Answers;

describe('קולט המיפויים (Code.gs)', () => {
  it('העמודות בקולט זהות לעמודות ה-CSV של האתר', () => {
    const { ctx } = loadCollector();
    expect(ctx.CSV_COLUMNS).toEqual(CSV_COLUMNS);
  });

  it('מיפוי תקין נשמר כשורה, עם כותרת בשורה הראשונה', () => {
    const { rows, post } = loadCollector();
    expect(post(buildPayload(mapping(fill(3, { T1: 1 }))))).toEqual({ ok: true, updated: false });
    expect(rows[0]).toEqual(['received_at', ...CSV_COLUMNS]);
    const rec = Object.fromEntries((rows[0] as string[]).map((h, i) => [h, rows[1][i]]));
    expect(rec.lecturer_name).toBe('ד"ר ישראלה ישראלי');
    expect(rec.T1).toBe(1);
    expect(rec.T_P).toBe(2.5);
    expect(rec.H_status).toBe('answered');
    expect(rec.academic_year).toBe('תשפ״ז');
    expect(Object.prototype.toString.call(rec.received_at)).toBe('[object Date]');
  });

  it('שליחה חוזרת של אותו מיפוי מעדכנת את השורה ואינה יוצרת כפילות', () => {
    const { rows, post } = loadCollector();
    const m = mapping(fill(2));
    post(buildPayload(m));
    expect(post(buildPayload({ ...m, answers: fill(4) }))).toEqual({ ok: true, updated: true });
    expect(rows).toHaveLength(2);
    post(buildPayload({ ...m, assessment_id: '11111111-2222-4333-8444-555555555555' }));
    expect(rows).toHaveLength(3);
  });

  it('מיומנות "לא רלוונטית" נשמרת עם תאים ריקים וסטטוס not_applicable', () => {
    const { rows, post } = loadCollector();
    const m = { ...mapping(fill(2)), answers: withoutSkill(fill(2), 'C'), not_applicable: ['C' as const] };
    expect(post(buildPayload(m)).ok).toBe(true);
    const rec = Object.fromEntries((rows[0] as string[]).map((h, i) => [h, rows[1][i]]));
    expect([rec.C1, rec.C_P, rec.C_status]).toEqual(['', '', 'not_applicable']);
  });

  it('נתונים לא תקינים נדחים ואינם נשמרים', () => {
    const { rows, post } = loadCollector();
    const good = buildPayload(mapping(fill(2))).row;
    for (const bad of [{ T1: 7 }, { assessment_id: 'x' }, { study_year: 9 }, { T_status: 'maybe' }, { lecturer_name: '' }, { academic_year: '=1+1' }]) {
      expect(post({ row: { ...good, ...bad } }).ok).toBe(false);
    }
    expect(post({}).ok).toBe(false);
    expect(rows.length).toBeLessThanOrEqual(1);
  });

  it('גיליון קיים עם כותרת ישנה (בלי שנה אקדמית): הכותרת מתעדכנת והנתונים נשמרים', () => {
    const { rows, post } = loadCollector();
    rows.push(['received_at', ...CSV_COLUMNS.slice(0, -1)]); // כותרת מהגרסה הקודמת
    rows.push(['old-row']);
    expect(post(buildPayload(mapping(fill(2)))).ok).toBe(true);
    expect(rows[0]).toEqual(['received_at', ...CSV_COLUMNS]);
    expect(rows[1]).toEqual(['old-row']);
    expect(rows[2][CSV_COLUMNS.indexOf('academic_year') + 1]).toBe('תשפ״ז');
  });

  it('מיפוי מגרסה קודמת של האתר (בלי שנה אקדמית) עדיין מתקבל', () => {
    const { rows, post } = loadCollector();
    const row = { ...buildPayload(mapping(fill(2))).row } as Record<string, unknown>;
    delete row.academic_year;
    expect(post({ row }).ok).toBe(true);
    expect(rows[1][CSV_COLUMNS.indexOf('academic_year') + 1]).toBe('');
  });

  it('טקסט שמתחיל בסימן נוסחה נשמר כטקסט', () => {
    const { rows, post } = loadCollector();
    post({ row: { ...buildPayload(mapping(fill(2))).row, course_name: '=IMPORTXML("x")' } });
    expect(rows[1][CSV_COLUMNS.indexOf('course_name') + 1]).toBe(`'=IMPORTXML("x")`);
  });
});

describe('הודעות מייל מהקולט', () => {
  it('בגרסה הציבורית אין כתובת ואין שליחת מייל', () => {
    const { ctx, mails, post } = loadCollector();
    expect(ctx.NOTIFY_EMAIL).toBe('');
    post(buildPayload(mapping(fill(2))));
    expect(mails).toHaveLength(0);
  });
  it('עם כתובת: מייל על מיפוי חדש ועל עדכון, בלי שם המרצה', () => {
    const { mails, post } = loadCollector({ email: 'team@example.test' });
    const m = mapping(fill(2));
    post(buildPayload(m));
    post(buildPayload(m));
    expect(mails.map((x) => x.subject)).toEqual(['מיפוי חדש התקבל: מבוא לריפוי בעיסוק', 'מיפוי עודכן: מבוא לריפוי בעיסוק']);
    expect(mails[0].to).toBe('team@example.test');
    expect(mails[0].body).toContain('מחלקה: ריפוי בעיסוק');
    expect(mails[0].body).toContain('שנת לימודים בתואר: ב׳');
    expect(mails[0].body).toContain('שנה אקדמית: תשפ״ז');
    expect(mails[0].body).toContain('https://docs.google.com/spreadsheets/d/X');
    expect(mails[0].body).not.toContain('ישראלי');
  });
  it('כשל בשליחת מייל אינו מונע את שמירת המיפוי', () => {
    const { rows, post } = loadCollector({ email: 'team@example.test', mailFails: true });
    expect(post(buildPayload(mapping(fill(2)))).ok).toBe(true);
    expect(rows).toHaveLength(2);
  });
});

describe('שליחה מהאתר', () => {
  it('שולח POST כ-text/plain עם שורת ה-CSV ומחזיר ok', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ ok: true })));
    expect(await submitMapping('https://example.test/exec', mapping(fill(1)), f as unknown as typeof fetch)).toBe('ok');
    const [, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toContain('text/plain');
    expect(Object.keys(JSON.parse(init.body as string).row)).toEqual(CSV_COLUMNS);
  });
  it('דחייה מהקולט מוחזרת כ-rejected; כשל רשת כ-failed', async () => {
    const rej = vi.fn(async () => new Response(JSON.stringify({ ok: false })));
    expect(await submitMapping('u', mapping(fill(1)), rej as unknown as typeof fetch)).toBe('rejected');
    const down = vi.fn(async () => { throw new TypeError('network'); });
    expect(await submitMapping('u', mapping(fill(1)), down as unknown as typeof fetch)).toBe('failed');
  });
});
