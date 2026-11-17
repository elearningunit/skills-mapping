// בדיקות דפדפן לממשק הרשות, מול הקובץ שמותקן ב-Apps Script (admin/apps-script/index.html).
// google.script.run מוחלף בשרת מדומה בזיכרון. נתוני הדוגמה בדויים.
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { parseCsv } from '../../src/lib/csvParse.mjs';
import { demoApi } from '../../src/admin/demo';

const PAGE = new URL('../../admin/apps-script/index.html', import.meta.url).href;
let browser: Browser;
let fixture: Awaited<ReturnType<ReturnType<typeof demoApi>['listMappings']>>;

beforeAll(async () => {
  browser = await chromium.launch();
  fixture = await demoApi().listMappings();
});
afterAll(async () => { await browser?.close(); });

/** שרת מדומה: מממש את google.script.run כמו ב-Apps Script (withSuccessHandler / withFailureHandler) */
function serverScript(data: unknown, opts: { deny?: boolean } = {}) {
  return `(() => {
    const state = ${JSON.stringify(data)};
    window.__calls = [];
    const decide = (r, d) => { r.decision = d; r.status = d === 'excluded' ? 'excluded' : d === 'included' ? 'valid' : (r.flags ? 'flagged' : 'valid'); };
    const fns = {
      listMappings() {
        if (${!!opts.deny}) throw new Error('אין הרשאה');
        return JSON.parse(JSON.stringify(state));
      },
      setDecision(id, action, note) {
        window.__calls.push([id, action, note]);
        const r = state.rows.find((x) => x.assessment_id === id);
        if (action === 'replace_previous') {
          decide(r, 'included');
          String(r.flags).split(' ').filter((f) => f.startsWith('possible_duplicate:')).forEach((f) => {
            const o = state.rows.find((x) => x.assessment_id === f.split(':')[1]); if (o) decide(o, 'excluded');
          });
        } else decide(r, action === 'include' ? 'included' : action === 'exclude' ? 'excluded' : '');
        state.log.push({ time: new Date().toISOString(), actor: 'elearningunit@g.ariel.ac.il', action: action === 'replace_previous' ? 'included_replacing' : action === 'reset' ? 'reset' : action + 'd', assessment_id: id, details: note });
        return { ok: true };
      },
    };
    const runner = (ok = () => {}, fail = () => {}) => {
      const r = {
        withSuccessHandler: (f) => runner(f, fail),
        withFailureHandler: (f) => runner(ok, f),
      };
      for (const name of Object.keys(fns)) r[name] = (...args) => setTimeout(() => {
        try { ok(fns[name](...args)); } catch (e) { fail({ message: e.message }); }
      }, 20);
      return r;
    };
    window.google = { script: { get run() { return runner(); } } };
  })();`;
}

async function open(opts: { deny?: boolean; width?: number } = {}) {
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: opts.width ?? 1500, height: 950 } });
  await ctx.addInitScript(serverScript(fixture, opts));
  const page = await ctx.newPage();
  const errors: string[] = [];
  const external: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', (r) => { if (!/^(file|data|blob):/.test(r.url())) external.push(r.url()); });
  await page.goto(PAGE);
  return { ctx, page, errors, external };
}

const rowsShown = (page: Page) => page.locator('.a-table tbody tr:not(:has(.a-empty))').count();
const kpis = async (page: Page) => (await page.locator('.a-kpi b').allTextContents()).map(Number);

describe('ממשק הרשות – רשימת המיפויים', () => {
  it('טוען את כל הדיווחים, מונים וצבעים; ללא שגיאות וללא קריאות רשת', async () => {
    const { ctx, page, errors, external } = await open();
    await page.waitForSelector('.a-table tbody tr');
    expect(await rowsShown(page)).toBe(7);
    expect(await kpis(page)).toEqual([7, 4, 2, 1]);
    expect(await page.locator('.a-table td.sc.na').count()).toBe(1); // מיומנות "לא רלוונטית"
    expect(await page.locator('.a-table td.sc.lv0').count()).toBeGreaterThan(0);
    expect(await page.locator('.a-user').textContent()).toContain('elearningunit@g.ariel.ac.il');
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
    await ctx.close();
  });

  it('סינון: מחלקה, שנה, סטטוס (גם בלחיצה על מונה), וחיפוש שמתעלם מתארים', async () => {
    const { ctx, page } = await open();
    await page.waitForSelector('.a-table tbody tr');
    await page.selectOption('#flt-department', 'ריפוי בעיסוק');
    expect(await rowsShown(page)).toBe(1);
    await page.click('button:has-text("ניקוי סינון")');
    await page.selectOption('#flt-year', '1');
    expect(await rowsShown(page)).toBe(3);
    await page.click('button:has-text("ניקוי סינון")');
    await page.click('.a-kpi.flagged');
    expect(await rowsShown(page)).toBe(2);
    expect(await page.inputValue('#flt-status')).toBe('flagged');
    await page.click('button:has-text("ניקוי סינון")');
    await page.fill('#flt-q', 'ד״ר נועה');
    expect(await rowsShown(page)).toBe(2);
    await page.fill('#flt-q', 'אין כזה קורס');
    expect(await page.locator('.a-empty').textContent()).toContain('אין דיווחים');
    await ctx.close();
  });

  it('שינוי פקולטה מצמצם את רשימת המחלקות ומאפס את הבחירה', async () => {
    const { ctx, page } = await open();
    await page.waitForSelector('.a-table tbody tr');
    await page.selectOption('#flt-department', 'סיעוד');
    await page.selectOption('#flt-faculty', 'הפקולטה להנדסה');
    expect(await page.inputValue('#flt-department')).toBe('');
    expect(await page.locator('#flt-department option').count()).toBe(8); // "הכול" + 7 מחלקות
    await ctx.close();
  });
});

describe('ממשק הרשות – פירוט והכרעה', () => {
  it('לחיצה על שורה פותחת פירוט עם 20 התשובות ("לא רלוונטי" ללא תשובות)', async () => {
    const { ctx, page } = await open();
    await page.waitForSelector('.a-table tbody tr');
    await page.locator('.a-table tbody tr', { hasText: 'פרופ׳ אבי כהן' }).click();
    expect(await page.locator('.a-detail h2').textContent()).toContain('יסודות הסיעוד');
    expect(await page.locator('.a-skill').count()).toBe(4);
    expect(await page.locator('.a-skill li').count()).toBe(15); // מיומנות אחת "לא רלוונטית"
    expect(await page.locator('.a-skill-h', { hasText: 'חשיבה יצירתית' }).textContent()).toContain('לא רלוונטי');
    // ניווט במקלדת
    await page.locator('.a-table tbody tr').first().focus();
    await page.keyboard.press('Enter');
    expect(await page.locator('.a-detail h2').textContent()).toContain('נועה לוי');
    await ctx.close();
  });

  it('כפילות: הסבר, הפניה לדיווח הדומה, ו"מחליף את הקודם" מעדכן את שניהם', async () => {
    const { ctx, page } = await open();
    await page.waitForSelector('.a-table tbody tr');
    await page.locator('.a-table tbody tr', { has: page.locator('.a-chip.flagged') }).filter({ hasText: 'נועה לוי' }).click();
    expect(await page.locator('.a-alert').textContent()).toContain('כפילות אפשרית');
    expect(await page.locator('.a-ref').textContent()).toContain('ד"ר נועה לוי');
    await page.fill('#decision-note', 'אותה מרצה, דיווח מתוקן');
    await page.click('button:has-text("זה דיווח חדש שמחליף את הקודם")');
    await page.waitForSelector('.a-notice:has-text("ההכרעה נשמרה")');
    const calls = await page.evaluate(() => (window as unknown as { __calls: unknown[] }).__calls);
    expect(calls).toEqual([['d0000000-0000-4000-8000-000000000002', 'replace_previous', 'אותה מרצה, דיווח מתוקן']]);
    expect(await kpis(page)).toEqual([7, 4, 1, 2]);
    expect(await page.locator('.a-detail .a-chip').first().textContent()).toBe('תקין');
    expect(await page.locator('.a-history').textContent()).toContain('הוכלל במקום הדיווח הקודם');
    await ctx.close();
  });

  it('החרגה וביטול החרגה', async () => {
    const { ctx, page } = await open();
    await page.waitForSelector('.a-table tbody tr');
    await page.locator('.a-table tbody tr', { hasText: 'פרמקולוגיה' }).click();
    await page.click('.a-actions button:has-text("החרגה")');
    await page.waitForSelector('.a-detail .a-chip.excluded');
    expect(await kpis(page)).toEqual([7, 3, 2, 2]);
    await page.click('.a-actions button:has-text("ביטול ההחרגה")');
    await page.waitForSelector('.a-detail .a-chip.valid');
    expect(await kpis(page)).toEqual([7, 4, 2, 1]);
    await ctx.close();
  });
});

describe('ממשק הרשות – ייצוא והרשאות', () => {
  it('ייצוא CSV של התצוגה המסוננת בלבד', async () => {
    const { ctx, page } = await open();
    await page.waitForSelector('.a-table tbody tr');
    await page.click('.a-kpi.valid');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("ייצוא CSV")')]);
    const csv = readFileSync((await dl.path())!, 'utf8');
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const [head, ...rows] = parseCsv(csv).filter((r) => r.length > 1);
    expect(head.slice(0, 3)).toEqual(['assessment_id', 'faculty', 'department']);
    expect(head).toContain('status');
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r[head.indexOf('status')] === 'valid')).toBe(true);
    await ctx.close();
  });

  it('דוח PDF לפי סינון: רק דיווחים תקינים, קובץ PDF תקין, ללא קריאות רשת', async () => {
    const { ctx, page, errors, external } = await open();
    await page.waitForSelector('.a-table tbody tr');
    await page.selectOption('#flt-department', 'סיעוד');
    expect(await page.locator('.pdf-root .pdf-page').count()).toBe(2);
    expect(await page.locator('.pdf-root h1').first().textContent()).toBe('מחלקת סיעוד');
    expect(await page.locator('.pdf-root .r-courses tbody tr').count()).toBe(4); // תקינים בלבד
    expect(await page.locator('.pdf-root .r-note').first().textContent()).toContain('2 ממתינים לבדיקה');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("דוח PDF")')]);
    expect(dl.suggestedFilename()).toMatch(/^skills_report_\d{4}-\d{2}-\d{2}_\d{4}\.pdf$/);
    const pdf = readFileSync((await dl.path())!);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect((pdf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length).toBe(2);
    expect(await page.locator('.a-notice').textContent()).toContain('2 עמודים');
    // סינון שאין בו דיווחים תקינים: הכפתור מושבת
    await page.selectOption('#flt-department', 'ריפוי בעיסוק');
    expect(await page.locator('button:has-text("דוח PDF")').isDisabled()).toBe(true);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
    await ctx.close();
  });

  it('כשהשרת מסרב (אין הרשאה): הודעה ברורה ואין נתונים במסך', async () => {
    const { ctx, page } = await open({ deny: true });
    await page.waitForSelector('[role="alert"]');
    expect(await page.locator('[role="alert"]').textContent()).toContain('אין הרשאה');
    expect(await page.locator('.a-table').count()).toBe(0);
    await ctx.close();
  });

  it('במסך צר: הטבלה נגללת בתוך המסגרת, והעמוד עצמו אינו נגלל לרוחב', async () => {
    const { ctx, page } = await open({ width: 800 });
    await page.waitForSelector('.a-table tbody tr');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    await ctx.close();
  });
});
