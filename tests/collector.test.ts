import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { CSV_COLUMNS } from '../src/lib/csv';
import { buildPayload, submitMapping } from '../src/lib/submit';
import type { Answers } from '../src/lib/types';
import { fill, mapping } from './helpers';

/** מריץ את Code.gs עם גיליון מדומה */
function loadCollector() {
  const rows: unknown[][] = [];
  const sheet = {
    getLastRow: () => rows.length,
    setFrozenRows: () => {},
    getRange: (r: number, c: number, nr: number, nc: number) => ({
      setValues: (v: unknown[][]) => { v.forEach((row, i) => { rows[r - 1 + i] = row; }); },
      getValues: () => rows.slice(r - 1, r - 1 + nr).map((row) => row.slice(c - 1, c - 1 + nc)),
    }),
  };
  const ctx: Record<string, unknown> = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => sheet, insertSheet: () => sheet }) },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (t: string) => ({ setMimeType: () => ({ text: t }) }),
    },
  };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(new URL('../collector/Code.gs', import.meta.url), 'utf8'), ctx);
  const post = (body: unknown) =>
    JSON.parse((ctx.doPost as (e: unknown) => { text: string })({ postData: { contents: JSON.stringify(body) } }).text);
  return { ctx, rows, post };
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
    for (const bad of [{ T1: 7 }, { assessment_id: 'x' }, { study_year: 9 }, { T_status: 'maybe' }, { lecturer_name: '' }]) {
      expect(post({ row: { ...good, ...bad } }).ok).toBe(false);
    }
    expect(post({}).ok).toBe(false);
    expect(rows.length).toBeLessThanOrEqual(1);
  });

  it('טקסט שמתחיל בסימן נוסחה נשמר כטקסט', () => {
    const { rows, post } = loadCollector();
    post({ row: { ...buildPayload(mapping(fill(2))).row, course_name: '=IMPORTXML("x")' } });
    expect(rows[1][CSV_COLUMNS.indexOf('course_name') + 1]).toBe(`'=IMPORTXML("x")`);
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
