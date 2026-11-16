import { useMemo, useRef, useState } from 'react';
import type { Mapping } from '../lib/types';
import { scoreApplicable } from '../lib/scoring';
import { recommend } from '../lib/recommendations';
import { buildInsights } from '../lib/insights';
import { buildCsv, csvFilename } from '../lib/csv';
import { downloadFile } from '../lib/download';
import { submitMapping } from '../lib/submit';
import { SUBMIT_URL } from '../config/collection';
import { ScoreChart } from '../components/ScoreChart';
import { DetailsList } from '../components/ReportParts';
import { PdfReport } from '../components/PdfReport';
import { ColorLegend, HeatMap } from '../components/Heat';
import { SKILLS } from '../config/questionnaire';

type Busy = '' | 'pdf' | 'csv' | 'send';

export function ResultsScreen({ mapping, onEdit }: { mapping: Mapping; onEdit: (step: number) => void }) {
  const scores = useMemo(() => scoreApplicable(mapping.answers, mapping.not_applicable), [mapping.answers, mapping.not_applicable]);
  const recs = useMemo(() => recommend(mapping.answers, 3, mapping.not_applicable), [mapping.answers, mapping.not_applicable]);
  const pdfRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<Busy>('');
  const [msg, setMsg] = useState('');

  const report = (r: string, what: string) =>
    setMsg(r === 'saved' ? `קובץ ה-${what} הוכן להורדה.` : `לא ניתן היה להוריד את קובץ ה-${what}. נסו שוב.`);

  const send = async () => {
    setBusy('send');
    setMsg('שולחים את המיפוי…');
    const r = await submitMapping(SUBMIT_URL, mapping);
    setMsg(
      r === 'ok' ? 'המיפוי נשלח לרשות לחדשנות בהוראה. אם תתקנו תשובות ותשלחו שוב, המיפוי יעודכן.'
        : r === 'sent_unconfirmed' ? 'המיפוי נשלח לרשות לחדשנות בהוראה.'
        : r === 'too_fast' ? 'המיפוי נשלח לפני רגע. אם תיקנתם תשובות, המתינו כמה שניות ושלחו שוב.'
        : r === 'rejected' ? 'המיפוי לא התקבל. נסו שוב, ואם הבעיה חוזרת הורידו קובץ CSV ושלחו אותו לרשות.'
        : 'לא ניתן היה לשלוח כרגע. בדקו את החיבור לאינטרנט ונסו שוב.',
    );
    setBusy('');
  };

  const exportCsv = async () => {
    setBusy('csv');
    const blob = new Blob([buildCsv(mapping)], { type: 'text/csv;charset=utf-8' });
    report(await downloadFile(csvFilename(mapping), blob), 'CSV');
    setBusy('');
  };

  const exportPdf = async () => {
    setBusy('pdf');
    setMsg('מכינים את קובץ ה-PDF…');
    try {
      const { buildPdf } = await import('../lib/pdf');
      const pages = [...(pdfRef.current?.querySelectorAll<HTMLElement>('.pdf-page') ?? [])];
      const blob = await buildPdf(pages);
      report(await downloadFile(csvFilename(mapping).replace(/\.csv$/, '.pdf'), blob), 'PDF');
    } catch {
      setMsg('לא ניתן היה ליצור את קובץ ה-PDF. נסו שוב.');
    }
    setBusy('');
  };

  return (
    <section className="results" aria-labelledby="r-h">
      <div className="card">
        <p className="eyebrow">שלב {SKILLS.length + 2} מתוך {SKILLS.length + 2} · תוצאות</p>
        <h1 id="r-h" tabIndex={-1}>{mapping.details.course_name}</h1>
        <DetailsList m={mapping} />
      </div>

      <div className="card export">
        <div>
          <h2>{SUBMIT_URL ? 'שליחה ושמירה' : 'שמירת התוצאות'}</h2>
          <p className="muted">
            {SUBMIT_URL
              ? 'כדי שהמיפוי יגיע לרשות לחדשנות בהוראה, לחצו "שליחה לרשות". אפשר גם להוריד עותק לעצמכם.'
              : 'הקבצים נוצרים בדפדפן שלכם, ללא חשבון וללא שליחה לשרת.'}
          </p>
        </div>
        <div className="export-btns">
          {SUBMIT_URL && (
            <button className="btn primary" onClick={send} disabled={busy !== ''}>
              {busy === 'send' ? 'שולח…' : 'שליחה לרשות'}
            </button>
          )}
          <button className={SUBMIT_URL ? 'btn' : 'btn primary'} onClick={exportPdf} disabled={busy !== ''}>
            {busy === 'pdf' ? 'מכין PDF…' : 'הורדת דוח PDF'}
          </button>
          <button className="btn" onClick={exportCsv} disabled={busy !== ''}>הורדת CSV</button>
        </div>
        <p className="export-msg" role="status" aria-live="polite">{msg}</p>
      </div>

      <div className="card">
        <h2>פרופיל ציונים</h2>
        <p className="muted">
          שמונה תוצאות נפרדות בסולם 0–4: תרגול (ממוצע ארבע השאלות הראשונות) והערכה (השאלה החמישית) לכל מיומנות. אין ציון כולל.
        </p>
        <ScoreChart scores={scores} idPrefix="screen" />
        <h3 className="sub-h">פירוט לפי שאלות</h3>
        <p className="muted">כל תא מציג את הדירוג ואת הרמה שלו. ירוק: דרישה או הערכה רחבה; אדום: דרישה או הערכה מועטה.</p>
        <ColorLegend />
        <HeatMap m={mapping} scores={scores} />
      </div>

      <div className="two-col">
        <div className="card">
          <h2>תובנות</h2>
          <ul className="insights rich">
            {buildInsights(mapping.answers, undefined, mapping.not_applicable).map((i) => <li key={i.id}><b>{i.title}.</b> {i.text}</li>)}
          </ul>
          <p className="hint">
            הדוח מבוסס על דיווח עצמי על ההוראה וההערכה בקורס, ואינו בודק ישירות רכישת מיומנויות אצל הסטודנטים.
          </p>
        </div>
        <div className="card">
          <h2>המלצות</h2>
          {recs.length ? (
            <ol className="recs">
              {recs.map((r) => <li key={r.rule + r.skill}><b>{r.title}.</b> {r.text}</li>)}
            </ol>
          ) : (
            <p>לא נמצאו המלצות לפי כללי היישום הנוכחיים.</p>
          )}
        </div>
      </div>

      <div className="card edit-card">
        <div className="edit-row">
          <span className="muted">לתיקון תשובות:</span>
          {SKILLS.map((s, i) => (
            <button key={s.key} className="btn ghost small" onClick={() => onEdit(i + 1)}>{s.name}</button>
          ))}
          <button className="btn ghost small" onClick={() => onEdit(0)}>פרטי הקורס</button>
        </div>
      </div>

      <div className="pdf-stage">
        <PdfReport ref={pdfRef} m={mapping} scores={scores} recs={recs} />
      </div>
    </section>
  );
}
