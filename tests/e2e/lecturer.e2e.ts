// בדיקות דפדפן לממשק המרצה, מול הקובץ הבנוי dist/index.html (כמו באתר).
// שליחה ל-Google מיורטת ומוחזרת מקולט מדומה — הבדיקות אינן יוצאות לרשת.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { parseCsv } from '../../src/lib/csvParse.mjs';

const SITE = new URL('../../dist/index.html', import.meta.url).href;
const COLLECTOR = 'https://script.google.com/**';

let browser: Browser;
beforeAll(async () => { browser = await chromium.launch(); });
afterAll(async () => { await browser?.close(); });

interface Ctx { ctx: BrowserContext; page: Page; errors: string[]; external: string[]; posts: Record<string, unknown>[] }

async function open(opts: { width?: number; collectorReply?: object } = {}): Promise<Ctx> {
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: opts.width ?? 1100, height: 900 } });
  const posts: Record<string, unknown>[] = [];
  await ctx.route(COLLECTOR, async (route) => {
    posts.push(JSON.parse(route.request().postData() || '{}'));
    await route.fulfill({
      status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(opts.collectorReply ?? { ok: true, updated: posts.length > 1 }),
    });
  });
  const page = await ctx.newPage();
  const errors: string[] = [];
  const external: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', (r) => {
    const u = r.url();
    if (!/^(file|data|blob):/.test(u) && !u.startsWith('https://script.google.com/')) external.push(u);
  });
  await page.goto(SITE);
  await begin(page);
  return { ctx, page, errors, external, posts };
}

/** עמוד הפתיחה → פרטי הקורס */
async function begin(page: Page) {
  await page.click('.intro button.primary');
  await page.waitForSelector('.stepper'); // פרטי הקורס, או השלב שנשמר בטיוטה
}

async function fillDetails(page: Page) {
  await page.selectOption('#f-faculty', 'הפקולטה למדעי הבריאות');
  await page.selectOption('#f-department', 'סיעוד');
  await page.selectOption('#f-academic_year', 'תשפ״ז');
  await page.selectOption('#f-study_year', '2');
  // למחלקה יש רשימת קורסים: "אחר" והקלדה ידנית (שם בדוי)
  await page.selectOption('#f-lecturer_name', '__other__');
  await page.fill('#f-lecturer_name', 'מרצה לבדיקה');
  await page.selectOption('#f-course_name', '__other__');
  await page.fill('#f-course_name', 'קורס, "לבדיקה"');
  await page.click('button:has-text("המשך לשאלון")');
  await page.waitForFunction(() => document.querySelector('h1')?.textContent === 'עבודת צוות');
  await settle(page);
}

/**
 * בחירה בתיבה/כפתור רדיו ישירות על האלמנט (ולא לפי מיקום על המסך), כדי שגלילה למעלה במעבר מסך
 * לא תגרום ללחיצה לנחות במקום אחר. מוודא שהבחירה נקלטה.
 */
async function tick(page: Page, selector: string, on = true) {
  const el = page.locator(selector);
  await el.waitFor({ state: 'attached' });
  if ((await el.isChecked()) !== on) await el.evaluate((node) => (node as HTMLInputElement).click());
  await page.waitForFunction(([sel, want]) => (document.querySelector(sel as string) as HTMLInputElement | null)?.checked === want, [selector, on]);
}

/** אחרי מעבר מסך: ממתין שהגלילה לראש העמוד הסתיימה ושהדפדפן צייר, לפני לחיצה על כפתור */
async function settle(page: Page) {
  await page.waitForFunction(() => window.scrollY === 0);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

const next = (page: Page) => page.click('.actions button.primary');
const statements = (page: Page) => page.locator('.questions .q').count();
const h1 = (page: Page) => page.locator('h1').first().textContent();

/** ממלא את כל המיומנויות; R מסומנת "לא רלוונטית" */
async function answerAll(page: Page) {
  const vals: Record<string, number[]> = { T: [3, 4, 3, 3, 1], C: [2, 2, 1, 2, 0], H: [3, 2, 4, 3, 0] };
  for (const k of ['T', 'C', 'R', 'H']) {
    await page.waitForSelector(`#na-${k}`);
    if (k === 'R') await tick(page, '#na-R');
    else for (let i = 1; i <= 5; i++) await tick(page, `input[name="q-${k}${i}"][value="${vals[k][i - 1]}"]`);
    const before = await h1(page);
    await next(page);
    await page.waitForFunction((t) => document.querySelector('h1')?.textContent !== t, before);
    await settle(page);
  }
}

describe('ממשק המרצה – פרטי הקורס', () => {
  it('כל ששת השדות חובה; שנה אקדמית תשפ״ו–תשפ״ט; שינוי פקולטה מאפס מחלקה', async () => {
    const { ctx, page, errors } = await open();
    await page.click('button:has-text("המשך לשאלון")');
    expect(await page.locator('.field-error').count()).toBe(6);
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('f-faculty');
    expect(await page.locator('#f-academic_year option').allTextContents()).toEqual(['בחרו שנה אקדמית', 'תשפ״ו', 'תשפ״ז', 'תשפ״ח', 'תשפ״ט']);
    await page.selectOption('#f-faculty', 'הפקולטה למדעי הבריאות');
    expect(await page.locator('#f-department option').count()).toBe(8);
    await page.selectOption('#f-department', 'סיעוד');
    await page.selectOption('#f-faculty', 'בית הספר לרפואה');
    expect(await page.inputValue('#f-department')).toBe('');
    expect(errors).toEqual([]);
    await ctx.close();
  });

  it('השדה הנסתר נגד בוטים אינו גלוי ואינו נגיש במקלדת', async () => {
    const { ctx, page } = await open();
    const hp = page.locator('#f-website');
    const box = await page.locator('.hp-field').boundingBox();
    expect(box!.width).toBeLessThanOrEqual(1);
    expect(box!.height).toBeLessThanOrEqual(1);
    expect(await page.locator('.hp-field').evaluate((el) => getComputedStyle(el).opacity)).toBe('0');
    expect(await hp.getAttribute('tabindex')).toBe('-1');
    expect(await page.locator('.hp-field').getAttribute('aria-hidden')).toBe('true');
    await ctx.close();
  });
});

describe('ממשק המרצה – שאלון', () => {
  it('"לא רלוונטי" מסתיר רק את היגדי המיומנות, ביטול מחזיר אותם ואת התשובות', async () => {
    const { ctx, page, errors } = await open();
    await fillDetails(page);
    expect(await h1(page)).toBe('עבודת צוות');
    await tick(page, 'input[name="q-T1"][value="3"]');
    await tick(page, '#na-T');
    expect(await statements(page)).toBe(0);
    await tick(page, '#na-T', false);
    expect(await statements(page)).toBe(5);
    expect(await page.isChecked('input[name="q-T1"][value="3"]')).toBe(true);
    await tick(page, '#na-T');
    await next(page);
    expect(await h1(page)).toBe('חשיבה ביקורתית');
    expect(await statements(page)).toBe(5);
    await next(page); // בלי תשובות — אסור להתקדם
    expect(await h1(page)).toBe('חשיבה ביקורתית');
    expect(await page.locator('.error-summary').count()).toBe(1);
    expect(errors).toEqual([]);
    await ctx.close();
  });

  it('ניווט בסרגל העליון; התוצאות זמינות רק אחרי השלמה', async () => {
    const { ctx, page } = await open();
    await fillDetails(page);
    expect(await page.locator('.stepper li:nth-child(6) button').getAttribute('aria-disabled')).toBe('true');
    await page.click('.stepper li:nth-child(5) button');
    expect(await h1(page)).toBe('חוסן, גמישות והסתגלות');
    await page.click('.stepper li:nth-child(1) button');
    expect(await h1(page)).toBe('פרטי הקורס');
    await ctx.close();
  });
});

describe('ממשק המרצה – תוצאות וייצוא', () => {
  it('סיכום מציג "לא רלוונטי"; CSV עם 42 עמודות; PDF בשני עמודים; ללא שגיאות וללא קריאות רשת', async () => {
    const { ctx, page, errors, external } = await open();
    await fillDetails(page);
    await answerAll(page);
    expect(await page.locator('.results').count()).toBe(1);
    const na = page.locator('.results > .card .heatmap td.na-cell');
    expect(await na.allTextContents()).toEqual(['לא רלוונטי']);

    const [csvDl] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("הורדת CSV")')]);
    const csv = readFileSync(fileURLToPath(new URL(`file://${await csvDl.path()}`)), 'utf8');
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const [head, row] = parseCsv(csv);
    expect(head).toHaveLength(42);
    const rec = Object.fromEntries(head.map((h, i) => [h, row[i]]));
    expect([rec.course_name, rec.academic_year, rec.T_P, rec.R1, rec.R_status]).toEqual(['קורס, "לבדיקה"', 'תשפ״ז', '3.25', '', 'not_applicable']);
    expect(rec.assessment_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const [pdfDl] = await Promise.all([page.waitForEvent('download', { timeout: 60_000 }), page.click('button:has-text("הורדת דוח PDF")')]);
    const pdf = readFileSync((await pdfDl.path())!).toString('latin1');
    expect(pdf.startsWith('%PDF')).toBe(true);
    expect(pdf.match(/\/Type\s*\/Page[^s]/g)).toHaveLength(2);

    expect(errors).toEqual([]);
    expect(external).toEqual([]);
    await ctx.close();
  });

  it('טיוטה: הבחירות ותאריך המיפוי נשמרים אחרי רענון', async () => {
    const { ctx, page } = await open();
    await tick(page, '#keep-draft');
    await fillDetails(page);
    await answerAll(page);
    const draft1 = await page.evaluate(() => JSON.parse(localStorage.getItem('skills-mapping:draft:v0.5') || '{}'));
    expect(draft1.assessment_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(draft1.not_applicable).toEqual(['R']);
    await page.reload();
    await begin(page);
    expect(await page.locator('.results').count()).toBe(1);
    await page.click('.stepper li:nth-child(4) button');
    expect(await page.isChecked('#na-R')).toBe(true);
    const draft2 = await page.evaluate(() => JSON.parse(localStorage.getItem('skills-mapping:draft:v0.5') || '{}'));
    expect(draft2.assessment_date).toBe(draft1.assessment_date);
    await ctx.close();
  });
});

describe('ממשק המרצה – שליחה לרשות', () => {
  it('שולח את שורת המיפוי עם שדה נסתר ריק; שליחה חוזרת אפשרית', async () => {
    const { ctx, page, posts, errors } = await open();
    await fillDetails(page);
    await answerAll(page);
    // לפני שליחה: הדגשה בראש העמוד ותזכורת בתחתיתו
    expect(await page.locator('.send-card h2').textContent()).toContain('שלב אחרון');
    expect(await page.locator('.send-reminder').count()).toBe(1);
    await page.click('.send-card button');
    await page.waitForFunction(() => /נשלח/.test(document.querySelector('.export-msg')?.textContent || ''));
    expect(posts).toHaveLength(1);
    // אחרי שליחה מוצלחת: אישור ירוק, והתזכורת נעלמת
    expect(await page.locator('.send-card.sent h2').textContent()).toContain('המיפוי נשלח לרשות');
    expect(await page.locator('.send-reminder').count()).toBe(0);
    const body = posts[0] as { row: Record<string, unknown>; hp: string };
    expect(body.hp).toBe('');
    expect(Object.keys(body.row)).toHaveLength(42);
    expect([body.row.department, body.row.academic_year, body.row.R_status]).toEqual(['סיעוד', 'תשפ״ז', 'not_applicable']);
    await page.click('.send-card button'); // "שליחה חוזרת (אחרי תיקון)"
    await page.waitForFunction(() => document.querySelectorAll('button[disabled]').length === 0);
    expect(posts).toHaveLength(2);
    expect(posts[1].row).toMatchObject({ assessment_id: body.row.assessment_id, assessment_date: body.row.assessment_date });
    expect(errors).toEqual([]);
    await ctx.close();
  });

  it('שליחה מהירה מדי: הודעה מתאימה למרצה', async () => {
    const { ctx, page } = await open({ collectorReply: { ok: false, error: 'too_fast' } });
    await fillDetails(page);
    await answerAll(page);
    await page.click('.send-card button');
    await page.waitForFunction(() => /לפני רגע/.test(document.querySelector('.export-msg')?.textContent || ''));
    await ctx.close();
  });
});

describe('ממשק המרצה – נייד', () => {
  it('אין גלילה אופקית ברוחב 390 פיקסלים', async () => {
    const { ctx, page } = await open({ width: 390 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    await fillDetails(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    await answerAll(page); // מסך התוצאות כולל את עמודי ה-PDF הנסתרים
    expect(await page.locator('.results').count()).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    await ctx.close();
  });
});

describe('ממשק המרצה – עמוד פתיחה', () => {
  it('מטרת המיפוי, "חשוב לדעת" והודעת הפרטיות בעמוד נפרד; פרטי הקורס רק אחרי לחיצה', async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(SITE);
    expect(await page.locator('.intro-purpose h2').textContent()).toBe('מטרת המיפוי');
    expect(await page.locator('.intro-purpose .intro-note').textContent()).toContain('המיפוי אינו כלי להערכת מרצים');
    expect(await page.locator('.intro .privacy-notice').count()).toBe(1);
    expect(await page.locator('#f-faculty').count()).toBe(0);
    expect(await page.locator('.stepper').count()).toBe(0);
    await begin(page);
    expect(await page.locator('.stepper').count()).toBe(1);
    expect(await page.locator('.privacy-notice').count()).toBe(0);
    await ctx.close();
  });
});

describe('ממשק המרצה – בחירה מרשימת הקורסים', () => {
  const LISTED = new URL('../../dist-e2e-courses/index.html', import.meta.url).href;
  async function openListed() {
    const c = await open();
    await c.page.goto(LISTED);
    await begin(c.page);
    await c.page.selectOption('#f-faculty', 'הפקולטה למדעי הבריאות');
    await c.page.selectOption('#f-department', 'סיעוד');
    return c;
  }

  it('לפני בחירת מחלקה: רשימות נעולות עם "בחרו קודם מחלקה" (לא שדות הקלדה)', async () => {
    const { ctx, page } = await open();
    await page.goto(LISTED);
    await begin(page);
    expect(await page.locator('select#f-lecturer_name').isDisabled()).toBe(true);
    expect(await page.locator('select#f-lecturer_name option').first().textContent()).toBe('בחרו קודם מחלקה');
    expect(await page.locator('input#f-lecturer_name').count()).toBe(0);
    await ctx.close();
  });

  it('בוחרים מרצה ואז רק את הקורסים שלו; השנה בתואר מתמלאת מהרשימה', async () => {
    const { ctx, page, errors } = await openListed();
    expect(await page.locator('#f-course_name').isDisabled()).toBe(true);
    await page.selectOption('#f-lecturer_name', 'ד"ר נועה לוי (דוגמה)');
    const opts = await page.locator('#f-course_name option').allTextContents();
    expect(opts).toEqual(['בחרו קורס', 'יסודות הסיעוד (דוגמה) (1001)', 'פרמקולוגיה (דוגמה) (1002)', 'אחר – הקורס לא ברשימה']);
    await page.selectOption('#f-course_name', 'פרמקולוגיה (דוגמה) (1002)');
    expect(await page.inputValue('#f-study_year')).toBe('2');
    await page.selectOption('#f-academic_year', 'תשפ״ז');
    await page.click('button:has-text("המשך לשאלון")');
    await page.waitForSelector('.skill-def');
    expect(errors).toEqual([]);
    await ctx.close();
  });

  it('"אחר": הקלדה ידנית של שם מרצה ושל קורס; שגיאה אם השדה נשאר ריק', async () => {
    const { ctx, page } = await openListed();
    await page.selectOption('#f-lecturer_name', '__other__');
    await page.fill('#f-lecturer_name', 'מרצה חדשה');
    // מרצה שאינו ברשימה רואה את כל קורסי המחלקה
    expect(await page.locator('#f-course_name option').count()).toBe(5);
    await page.selectOption('#f-course_name', '__other__');
    await page.selectOption('#f-academic_year', 'תשפ״ז');
    await page.selectOption('#f-study_year', '1');
    await page.click('button:has-text("המשך לשאלון")');
    expect(await page.locator('#e-course_name').textContent()).toContain('שם הקורס');
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('f-course_name');
    await page.fill('#f-course_name', 'קורס בחירה חדש');
    await page.click('button:has-text("המשך לשאלון")');
    await page.waitForSelector('.skill-def');
    // חזרה לפרטים: הערכים הידניים נשמרו ו"אחר" נשאר מסומן
    await page.click('.stepper button >> nth=0');
    expect(await page.inputValue('#f-lecturer_name')).toBe('מרצה חדשה');
    expect(await page.inputValue('#f-lecturer_pick')).toBe('__other__');
    expect(await page.inputValue('#f-course_name')).toBe('קורס בחירה חדש');
    await ctx.close();
  });

  it('מחלקה שאין לה רשימה: שדות טקסט חופשי כמו קודם', async () => {
    const { ctx, page } = await openListed();
    await page.selectOption('#f-department', 'פיזיותרפיה');
    expect(await page.locator('input#f-lecturer_name').count()).toBe(1);
    expect(await page.locator('input#f-course_name').count()).toBe(1);
    await ctx.close();
  });
});

