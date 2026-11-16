import { ANCHORS, SCALE } from '../config/questionnaire';

export function AnchorsTable({ compact = false }: { compact?: boolean }) {
  return (
    <div className="table-wrap">
      <table className={`anchors ${compact ? 'compact' : ''}`}>
        <caption className="sr-only">עוגני דירוג 0–4</caption>
        <thead>
          <tr>
            <th scope="col">ציון</th>
            <th scope="col">שאלות 1–4: תרגול</th>
            <th scope="col">שאלה 5: הערכה</th>
          </tr>
        </thead>
        <tbody>
          {SCALE.map((v) => (
            <tr key={v}>
              <th scope="row" className="num">{v}</th>
              <td>{ANCHORS[v].practice}</td>
              <td>{ANCHORS[v].assessment}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ScaleHelp() {
  return (
    <details className="scale-help">
      <summary>מה משמעות הציונים?</summary>
      <AnchorsTable />
      <p className="hint">0 הוא תשובה תקפה: ההתנהגות אינה נדרשת בקורס, או שאין הערכה מפורשת שלה.</p>
    </details>
  );
}
