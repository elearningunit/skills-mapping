import { useState } from 'react';
import { ANCHORS, SKILLS, type Rating } from '../config/questionnaire';
import { levelOf } from '../lib/levels';
import { fmt2 } from '../lib/scoring';
import {
  ACTION_LOG_LABELS, actionsFor, duplicateRefs, flagLabel, formatDate, formatDateTime, STATUS_LABELS, yearLabel,
  type Action, type AdminRecord, type LogEntry,
} from './model';

export function DetailPanel({ r, all, log, onDecide }: {
  r: AdminRecord; all: AdminRecord[]; log: LogEntry[];
  onDecide: (action: Action, note: string) => Promise<void>;
}) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const refs = duplicateRefs(r).map((id) => all.find((x) => x.id === id)).filter(Boolean) as AdminRecord[];
  const history = log.filter((l) => l.assessment_id === r.id).sort((a, b) => (a.time < b.time ? -1 : 1));

  const decide = async (action: Action) => {
    setBusy(true); setError('');
    try { await onDecide(action, note.trim()); setNote(''); }
    catch (e) { setError((e as Error).message || 'ההכרעה לא נשמרה. נסו שוב.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="a-card a-detail">
      <h2>{r.course} · {r.lecturer}</h2>
      <p className="a-meta">
        {r.courseNumber && <>קורס <span dir="ltr">{r.courseNumber}</span> · </>}{r.faculty} · {r.department} · {r.academicYear} · {yearLabel(r.studyYear)}
        <br />נוצר {formatDate(r.createdAt)} · תאריך מיפוי {formatDate(r.assessmentDate)} · {r.submissions === 1 ? 'נשלח פעם אחת' : `נשלח ${r.submissions} פעמים`}
      </p>
      <p><span className={`a-chip ${r.status}`}>{STATUS_LABELS[r.status]}</span>
        {r.decision && <span className="a-decided"> · הוכרע ע״י הרשות</span>}</p>

      {r.status === 'flagged' && (
        <div className="a-alert">
          <b>ממתין לבדיקה. הדיווח אינו נספר עד שתכריעו.</b>
          <ul>
            {r.flags.map((f) => <li key={f}>{flagLabel(f)}</li>)}
          </ul>
          {refs.map((o) => (
            <p key={o.id} className="a-ref">
              דומה לדיווח מ-{formatDate(o.createdAt)}: <b>{o.course}</b> · {o.lecturer} ({STATUS_LABELS[o.status]})
            </p>
          ))}
        </div>
      )}

      <div className="a-actions">
        {actionsFor(r).map((a) => (
          <button key={a.action} type="button" className={`a-btn ${a.primary ? 'primary' : ''}`} disabled={busy} onClick={() => void decide(a.action)}>
            {a.label}
          </button>
        ))}
      </div>
      <label className="a-note">הערה ליומן (לא חובה)
        <input id="decision-note" type="text" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
      </label>
      {busy && <p role="status">שומר…</p>}
      {error && <p className="a-error" role="alert">{error}</p>}

      <h3>20 התשובות</h3>
      {SKILLS.map((s) => {
        const res = r.skills.find((x) => x.key === s.key)!;
        return (
          <section key={s.key} className="a-skill">
            <div className="a-skill-h">
              <b>{s.name}</b>
              <span>{res.notApplicable ? 'לא רלוונטי' : `תרגול ${res.practice === null ? '—' : fmt2(res.practice)} · הערכה ${res.assessment === null ? '—' : fmt2(res.assessment)}`}</span>
            </div>
            {!res.notApplicable && (
              <ol>
                {s.items.map((i) => {
                  const v = r.answers[i.code];
                  const valid = v !== null && v !== undefined && v >= 0 && v <= 4 && Number.isInteger(v);
                  return (
                    <li key={i.code} title={i.text}>
                      <span className="a-code" dir="ltr">{i.code}</span>
                      <span className="a-dim">{i.dimension}</span>
                      <span className={`a-dot ${valid ? `lv${levelOf(v!)}` : 'bad'}`}
                        title={valid ? (i.kind === 'practice' ? ANCHORS[v as Rating].practice : ANCHORS[v as Rating].assessment) : 'ערך לא תקין'}>
                        {v ?? '—'}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        );
      })}

      <h3>היסטוריה</h3>
      <ul className="a-history">
        {history.length
          ? history.map((h, i) => (
            <li key={i}>
              {formatDateTime(h.time)} · {ACTION_LOG_LABELS[h.action] ?? h.action}
              {h.actor !== 'collector' && h.actor !== 'migrate' && <> · <span dir="ltr">{h.actor}</span></>}
              {h.details && !/^(valid|flagged)/.test(h.details) && <> · {h.details}</>}
            </li>
          ))
          : <li>אין רישומים ביומן.</li>}
      </ul>
    </div>
  );
}
