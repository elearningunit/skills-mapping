import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ACADEMIC_YEARS, SKILLS, STUDY_YEARS } from '../config/questionnaire';
import { FACULTIES, departmentsOf } from '../config/units';
import { CSV_COLUMNS, escapeCsv, guardFormula } from '../lib/csv';
import { LEVEL_LABELS, levelOf } from '../lib/levels';
import { fmt2 } from '../lib/scoring';
import { getApi } from './api';
import logo from '../assets/logo-teaching-innovation.png';
import {
  applyFilters, counts, EMPTY_FILTERS, exportRows, formatDate, sortNewestFirst, STATUS_LABELS, toRecord,
  flagLabel, type AdminData, type AdminRecord, type Filters,
} from './model';
import { DetailPanel } from './DetailPanel';
import { AdminReport } from './AdminReport';
import { reportFilename } from './report';

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; data: AdminData };

export function AdminApp() {
  const api = useMemo(() => getApi(), []);
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState<string>('');
  const [notice, setNotice] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [reportDate, setReportDate] = useState<Date | null>(null); // הדוח נבנה רק בזמן ההפקה
  const reportRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    if (!api) { setLoad({ state: 'error', message: 'המסך פועל רק מתוך אפליקציית Apps Script של הרשות.' }); return; }
    setLoad((l) => (l.state === 'ready' ? l : { state: 'loading' }));
    try {
      setLoad({ state: 'ready', data: await api.listMappings() });
    } catch (e) {
      setLoad({ state: 'error', message: (e as Error).message || 'לא ניתן היה לטעון את הנתונים.' });
    }
  }, [api]);

  useEffect(() => { void refresh(); }, [refresh]);

  const records = useMemo(
    () => (load.state === 'ready' ? sortNewestFirst(load.data.rows.map(toRecord)) : []),
    [load],
  );
  const shown = useMemo(() => applyFilters(records, filters), [records, filters]);
  const c = counts(records);
  const selected = records.find((r) => r.id === selectedId) ?? null;
  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));

  // הדוח כולל רק דיווחים תקינים מתוך התצוגה המסוננת (בלי קשר לסינון הסטטוס)
  const reportFilters = { ...filters, status: '' as const };
  const reportPool = useMemo(() => applyFilters(records, reportFilters), [records, filters]); // eslint-disable-line react-hooks/exhaustive-deps
  const reportRecs = useMemo(() => reportPool.filter((r) => r.status === 'valid'), [reportPool]);
  const reportLeft = {
    flagged: reportPool.filter((r) => r.status === 'flagged').length,
    excluded: reportPool.filter((r) => r.status === 'excluded').length,
  };

  const exportPdf = async () => {
    if (!reportRecs.length) return;
    setPdfBusy(true); setNotice('');
    try {
      const now = new Date();
      setReportDate(now);
      await new Promise((r) => setTimeout(r, 30)); // לתת ל-React לצייר את הדוח עם התאריך
      const { buildPdf } = await import('../lib/pdf');
      const pages = [...(reportRef.current?.querySelectorAll<HTMLElement>('.pdf-page') ?? [])];
      const blob = await buildPdf(pages);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = reportFilename(now);
      document.body.appendChild(a); a.click(); a.remove();
      setNotice(`הופק דוח PDF (${pages.length} עמודים) על ${reportRecs.length} דיווחים תקינים.`);
    } catch (e) {
      setNotice(`לא ניתן היה להפיק PDF: ${(e as Error).message || 'שגיאה'}`);
    } finally {
      setPdfBusy(false);
      setReportDate(null);
    }
  };

  const exportCsv = () => {
    if (load.state !== 'ready') return;
    const raw = exportRows(load.data.rows, new Set(shown.map((r) => r.id)));
    const cols = [...CSV_COLUMNS, 'created_at', 'submissions', 'status', 'flags', 'decision'];
    const lines = [cols.join(','), ...raw.map((r) => cols.map((k) => escapeCsv(guardFormula(String(r[k] ?? '')))).join(','))];
    const blob = new Blob(['﻿' + lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `mappings_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setNotice(`יוצאו ${raw.length} דיווחים לקובץ CSV.`);
  };

  return (
    <div className="admin">
      <header className="a-top">
        <div className="a-brand">
          <img className="a-logo" src={logo} alt="אוניברסיטת אריאל בשומרון – הרשות לחדשנות בהוראה" />
          <div>
            <strong>ממשק הרשות – מיפוי מיומנויות</strong>
            <small>הרשות לחדשנות בהוראה</small>
          </div>
        </div>
        <div className="a-user">
          {load.state === 'ready' && <span>מחובר/ת: <span dir="ltr">{load.data.me}</span></span>}
          <button type="button" className="a-btn" onClick={() => void refresh()}>רענון</button>
        </div>
      </header>

      {load.state === 'loading' && <p className="a-state" role="status">טוען נתונים…</p>}
      {load.state === 'error' && <p className="a-state a-error" role="alert">{load.message}</p>}

      {load.state === 'ready' && (
        <main className="a-main">
          <section className="a-left">
            <div className="a-kpis" aria-label="סיכום">
              <button type="button" className={`a-kpi ${filters.status === '' ? 'on' : ''}`} onClick={() => set({ status: '' })}>
                <span>סה״כ דיווחים</span><b>{c.total}</b>
              </button>
              <button type="button" className={`a-kpi valid ${filters.status === 'valid' ? 'on' : ''}`} onClick={() => set({ status: 'valid' })}>
                <span>תקינים (נספרים)</span><b>{c.valid}</b>
              </button>
              <button type="button" className={`a-kpi flagged ${filters.status === 'flagged' ? 'on' : ''}`} onClick={() => set({ status: 'flagged' })}>
                <span>ממתינים לבדיקה</span><b>{c.flagged}</b>
              </button>
              <button type="button" className={`a-kpi excluded ${filters.status === 'excluded' ? 'on' : ''}`} onClick={() => set({ status: 'excluded' })}>
                <span>מוחרגים</span><b>{c.excluded}</b>
              </button>
            </div>

            <div className="a-card">
              <div className="a-filters">
                <label>פקולטה
                  <select id="flt-faculty" value={filters.faculty} onChange={(e) => set({ faculty: e.target.value, department: '' })}>
                    <option value="">הכול</option>
                    {FACULTIES.map((f) => <option key={f}>{f}</option>)}
                  </select>
                </label>
                <label>מחלקה
                  <select id="flt-department" value={filters.department} onChange={(e) => set({ department: e.target.value })}>
                    <option value="">הכול</option>
                    {(filters.faculty ? departmentsOf(filters.faculty) : [...new Set(FACULTIES.flatMap(departmentsOf))]).map((d) => <option key={d}>{d}</option>)}
                  </select>
                </label>
                <label>שנה אקדמית
                  <select id="flt-ay" value={filters.academicYear} onChange={(e) => set({ academicYear: e.target.value })}>
                    <option value="">הכול</option>
                    {ACADEMIC_YEARS.map((y) => <option key={y}>{y}</option>)}
                  </select>
                </label>
                <label>שנה בתואר
                  <select id="flt-year" value={filters.studyYear} onChange={(e) => set({ studyYear: e.target.value })}>
                    <option value="">הכול</option>
                    {STUDY_YEARS.map((y) => <option key={y.value} value={y.value}>{y.label}</option>)}
                  </select>
                </label>
                <label>סטטוס
                  <select id="flt-status" value={filters.status} onChange={(e) => set({ status: e.target.value as Filters['status'] })}>
                    <option value="">הכול</option>
                    <option value="valid">תקין</option>
                    <option value="flagged">לבדיקה</option>
                    <option value="excluded">מוחרג</option>
                  </select>
                </label>
                <label className="a-search">חיפוש
                  <input id="flt-q" type="search" placeholder="שם קורס, מספר קורס או מרצה" value={filters.q} onChange={(e) => set({ q: e.target.value })} />
                </label>
                <div className="a-filter-actions">
                  <button type="button" className="a-btn ghost" onClick={() => setFilters(EMPTY_FILTERS)}>ניקוי סינון</button>
                  <button type="button" className="a-btn primary" onClick={() => void exportPdf()} disabled={!reportRecs.length || pdfBusy}
                    title="דוח לפי הסינון הנוכחי, לשליחה לרמ״ח, לדיקן או למרצה. כולל רק דיווחים תקינים.">
                    {pdfBusy ? 'מכין PDF…' : 'דוח PDF'}
                  </button>
                  <button type="button" className="a-btn" onClick={exportCsv} disabled={!shown.length}>ייצוא CSV</button>
                </div>
              </div>
              <p className="a-count" role="status">מוצגים {shown.length} מתוך {records.length} דיווחים</p>
              {notice && <p className="a-notice" role="status">{notice}</p>}

              <div className="a-table-wrap">
                <table className="a-table">
                  <caption className="sr-only">רשימת המיפויים</caption>
                  <thead>
                    <tr>
                      <th rowSpan={2}>תאריך</th><th rowSpan={2}>מחלקה</th><th rowSpan={2}>שנה אק׳</th><th rowSpan={2}>שנה</th>
                      <th rowSpan={2}>קורס</th><th rowSpan={2}>מרצה</th>
                      {SKILLS.map((s) => <th key={s.key} colSpan={2} className="g">{s.name}</th>)}
                      <th rowSpan={2}>סטטוס</th>
                    </tr>
                    <tr>{SKILLS.map((s) => [<th key={s.key + 'P'} className="g s">תרגול</th>, <th key={s.key + 'A'} className="s">הערכה</th>])}</tr>
                  </thead>
                  <tbody>
                    {shown.map((r) => (
                      <Row key={r.id} r={r} selected={r.id === selectedId} onSelect={() => setSelectedId(r.id)} />
                    ))}
                    {!shown.length && (
                      <tr><td colSpan={15} className="a-empty">{records.length ? 'אין דיווחים שתואמים לסינון.' : 'עדיין לא התקבלו דיווחים.'}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="a-legend">
                צבע = רמת הציון:
                {([0, 1, 2, 3, 4] as const).map((l) => <i key={l} className={`lv${l}`}>{LEVEL_LABELS[l]}</i>)}
                · אפור = "לא רלוונטי" · לחיצה על שורה פותחת את הפירוט
              </p>
            </div>
          </section>

          <aside className="a-right" aria-label="פירוט הדיווח">
            {selected
              ? <DetailPanel key={selected.id} r={selected} all={records} log={load.data.log}
                  onDecide={async (action, note) => {
                    await api!.setDecision(selected.id, action, note);
                    await refresh();
                    setNotice('ההכרעה נשמרה ונרשמה ביומן.');
                  }} />
              : <div className="a-card a-hint">בחרו שורה בטבלה כדי לראות את פרטי הדיווח ואת 20 התשובות.</div>}
          </aside>
          {reportDate && (
            <div className="pdf-stage">
              <AdminReport ref={reportRef} recs={reportRecs} filters={reportFilters} excluded={reportLeft} date={reportDate} />
            </div>
          )}
        </main>
      )}
    </div>
  );
}

function Row({ r, selected, onSelect }: { r: AdminRecord; selected: boolean; onSelect: () => void }) {
  return (
    <tr className={selected ? 'sel' : ''} tabIndex={0} aria-selected={selected}
      onClick={onSelect} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }}>
      <td className="nowrap">{formatDate(r.createdAt)}</td>
      <td>{r.department}</td>
      <td className="nowrap">{r.academicYear}</td>
      <td className="c">{STUDY_YEARS.find((y) => y.value === r.studyYear)?.label.replace('שנה ', '') ?? ''}</td>
      <td><b>{r.course}</b>{r.courseNumber && <small className="a-num" dir="ltr"> {r.courseNumber}</small>}</td>
      <td>{r.lecturer}</td>
      {r.skills.map((s) =>
        s.notApplicable
          ? <td key={s.key} colSpan={2} className="sc na">לא רלוונטי</td>
          : [<ScoreCell key={s.key + 'P'} v={s.practice} />, <ScoreCell key={s.key + 'A'} v={s.assessment} />],
      )}
      <td>
        <span className={`a-chip ${r.status}`}>{STATUS_LABELS[r.status]}</span>
        {r.status === 'flagged' && r.flags[0] && <div className="a-flag">{flagLabel(r.flags[0])}</div>}
      </td>
    </tr>
  );
}

function ScoreCell({ v }: { v: number | null }) {
  if (v === null) return <td className="sc empty">—</td>;
  const l = levelOf(v);
  return <td className={`sc lv${l}`} title={LEVEL_LABELS[l]}>{fmt2(v)}</td>;
}
