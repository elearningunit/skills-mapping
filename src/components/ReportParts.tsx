import { QUESTIONNAIRE_VERSION, SKILLS, STUDY_YEARS } from '../config/questionnaire';
import type { Mapping } from '../lib/types';
import { fmt2, type SkillScore } from '../lib/scoring';
import { LEVEL_LABELS, levelOf } from '../lib/levels';

export function yearLabel(y: number | null) {
  return STUDY_YEARS.find((s) => s.value === y)?.label ?? '';
}

export function formatDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export function DetailsList({ m }: { m: Mapping }) {
  const d = m.details;
  const rows: [string, string, boolean?][] = [
    ['שם המרצה', d.lecturer_name],
    ['שם הקורס', d.course_name],
    ['פקולטה / בית ספר', d.faculty],
    ['מחלקה / בית ספר', d.department],
    ['שנת לימודים בתואר', yearLabel(d.study_year)],
    ['תאריך מיפוי', formatDate(m.assessment_date)],
    ['גרסת שאלון', QUESTIONNAIRE_VERSION, true],
  ];
  return (
    <dl className="details">
      {rows.map(([k, v, ltr]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd dir={ltr ? 'ltr' : undefined}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ScoreTiles({ scores }: { scores: Record<string, SkillScore> }) {
  const cell = (k: string, v: number, unit: string) => {
    const l = levelOf(v);
    return (
      <div className={`lv lv${l}`}>
        <span className="k">{k}</span>
        <span className="v">{fmt2(v)}</span>
        <span className="lvl">{LEVEL_LABELS[l]}</span>
        <span className="u" dir="ltr">{unit}</span>
      </div>
    );
  };
  return (
    <div className="tiles">
      {SKILLS.map((s) => (
        <div className="tile" key={s.key}>
          <h3>{s.name}</h3>
          <div className="pair">
            {cell('תרגול', scores[s.key].practice, `${s.key}1–${s.key}4`)}
            {cell('הערכה', scores[s.key].assessment, `${s.key}5`)}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ItemsTable({ m, compact = false }: { m: Mapping; compact?: boolean }) {
  return (
    <div className="table-wrap">
      <table className={`items ${compact ? 'compact' : ''}`}>
        <caption className="sr-only">פירוט הדירוגים</caption>
        <thead>
          <tr>
            <th scope="col">קוד</th>
            <th scope="col">ממד</th>
            <th scope="col">שאלה</th>
            <th scope="col">דירוג</th>
          </tr>
        </thead>
        {SKILLS.map((s) => (
          <tbody key={s.key}>
            <tr className="group">
              <th colSpan={4} scope="colgroup">{s.name}</th>
            </tr>
            {s.items.map((i) => (
              <tr key={i.code} className={i.kind}>
                <td><span className="code" dir="ltr">{i.code}</span></td>
                <td>{i.dimension}</td>
                <td className="qcell">{i.text}</td>
                <td className={`num rate lv lv${m.answers[i.code]}`}>
                  <span className="rv">{m.answers[i.code]}</span>
                  <span className="rl">{LEVEL_LABELS[levelOf(m.answers[i.code] as number)]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}
