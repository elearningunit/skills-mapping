import { forwardRef } from 'react';
import { SKILLS, STUDY_YEARS } from '../config/questionnaire';
import { LEVEL_LABELS, levelOf } from '../lib/levels';
import { fmt2 } from '../lib/scoring';
import { ScoreChart } from '../components/ScoreChart';
import type { AdminRecord, Filters } from './model';
import {
  aggregate, byStudyYear, chunk, programObservations, reportRows, reportScope, ROWS_PER_PAGE, toScoreMap,
} from './report';

/** דוח PDF לפי הסינון: עמוד סיכום (ממוצעים, לפי שנים, נקודות לתשומת לב) ועמודי פירוט לפי קורסים. A4 = 794×1123. */
export const AdminReport = forwardRef<HTMLDivElement, {
  recs: AdminRecord[]; filters: Filters; excluded: { flagged: number; excluded: number }; date: Date;
}>(function AdminReport({ recs, filters, excluded, date }, ref) {
  const { title, scope } = reportScope(filters, recs);
  const aggs = aggregate(recs);
  const years = byStudyYear(recs);
  const obs = programObservations(recs);
  const pages = chunk(reportRows(recs), ROWS_PER_PAGE);
  const total = 1 + pages.length;
  const lecturers = new Set(recs.map((r) => r.lecturer.trim())).size;
  const courses = new Set(recs.map((r) => `${r.course.trim()}|${r.studyYear}`)).size;
  const dateText = date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const Head = ({ n, h }: { n: number; h: string }) => (
    <header className="pdf-head">
      <div>
        <p className="eyebrow">דוח מיפוי מיומנויות · הרשות לחדשנות בהוראה</p>
        <h1>{h}</h1>
      </div>
      <span className="pdf-pg">עמוד {n} מתוך {total}</span>
    </header>
  );

  return (
    <div ref={ref} className="pdf-root" aria-hidden="true" dir="rtl">
      <div className="pdf-page">
        <Head n={1} h={title} />
        <p className="r-scope">{scope.join(' · ')} · הופק {dateText}</p>
        <div className="r-kpis">
          <div><b>{recs.length}</b><span>דיווחים</span></div>
          <div><b>{courses}</b><span>קורסים</span></div>
          <div><b>{lecturers}</b><span>מרצים</span></div>
        </div>
        {(excluded.flagged > 0 || excluded.excluded > 0) && (
          <p className="r-note">
            נכללו רק דיווחים תקינים. לא נכללו: {[excluded.flagged && `${excluded.flagged} ממתינים לבדיקה`, excluded.excluded && `${excluded.excluded} מוחרגים`].filter(Boolean).join(', ')}.
          </p>
        )}
        {recs.length > 0 && recs.length < 3 && <p className="r-note">הדוח מבוסס על מספר קטן של דיווחים, ולכן הממוצעים זהירים.</p>}

        <h2>פרופיל ממוצע</h2>
        <ScoreChart scores={toScoreMap(aggs)} idPrefix="rpt" />
        <p className="r-small">
          {aggs.map((a) => `${a.name}: ${a.n} קורסים${a.na ? ` (${a.na} לא רלוונטי)` : ''}`).join(' · ')}
        </p>

        {years.length > 1 && (
          <>
            <h2>לפי שנה בתואר (ממוצע תרגול / הערכה)</h2>
            <table className="r-table r-years">
              <thead>
                <tr><th rowSpan={2}>שנה</th><th rowSpan={2}>קורסים</th>{SKILLS.map((s) => <th key={s.key} colSpan={2}>{s.name}</th>)}</tr>
                <tr>{SKILLS.map((s) => [<th key={s.key + 'P'} className="s">תרגול</th>, <th key={s.key + 'A'} className="s">הערכה</th>])}</tr>
              </thead>
              <tbody>
                {years.map((y) => (
                  <tr key={y.year}>
                    <td>{y.label}</td><td className="c">{y.n}</td>
                    {y.skills.map((a) => (a.practice === null || a.assessment === null
                      ? <td key={a.key} colSpan={2} className="sc na">לא רלוונטי</td>
                      : [<Cell key={a.key + 'P'} v={a.practice} />, <Cell key={a.key + 'A'} v={a.assessment} />]))}
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <h2>נקודות לתשומת לב</h2>
        <ul className="insights rich">
          {obs.map((o) => <li key={o.id}><b>{o.title}.</b> {o.text}</li>)}
        </ul>
        <Foot />
      </div>

      {pages.map((rows, i) => (
        <div className="pdf-page" key={i}>
          <Head n={i + 2} h={`${title} · פירוט לפי קורסים`} />
          <table className="r-table r-courses">
            <thead>
              <tr>
                <th rowSpan={2}>קורס</th><th rowSpan={2}>מרצה</th><th rowSpan={2}>שנה</th>
                {SKILLS.map((s) => <th key={s.key} colSpan={2}>{s.name}</th>)}
              </tr>
              <tr>{SKILLS.map((s) => [<th key={s.key + 'P'} className="s">תרגול</th>, <th key={s.key + 'A'} className="s">הערכה</th>])}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><b>{r.course}</b>{r.courseNumber && <span className="r-ay"> ({r.courseNumber})</span>}{!filters.academicYear && <span className="r-ay"> · {r.academicYear}</span>}</td>
                  <td>{r.lecturer}</td>
                  <td className="c">{STUDY_YEARS.find((y) => y.value === r.studyYear)?.label.replace('שנה ', '') ?? ''}</td>
                  {r.skills.map((s) => (s.notApplicable
                    ? <td key={s.key} colSpan={2} className="sc na">לא רלוונטי</td>
                    : [<Cell key={s.key + 'P'} v={s.practice} />, <Cell key={s.key + 'A'} v={s.assessment} />]))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="a-legend r-legend">
            צבע = רמת הציון (0–4):
            {([0, 1, 2, 3, 4] as const).map((l) => <i key={l} className={`lv${l}`}>{LEVEL_LABELS[l]}</i>)}
          </p>
          <Foot />
        </div>
      ))}
    </div>
  );
});

function Cell({ v }: { v: number | null }) {
  if (v === null) return <td className="sc empty">—</td>;
  return <td className={`sc lv${levelOf(v)}`}>{fmt2(v)}</td>;
}

function Foot() {
  return (
    <p className="pdf-foot">
      דיווח עצמי של המרצים על ההוראה וההערכה בקורסים. אין זו בדיקה ישירה של רכישת מיומנויות אצל הסטודנטים, ואין זה מדד להערכת מרצים.
    </p>
  );
}
