import { SKILLS } from '../config/questionnaire';
import { LEVEL_LABELS, LEVEL_RANGES, levelOf, type Level } from '../lib/levels';
import { fmt2, type ScoreMap } from '../lib/scoring';
import type { Mapping } from '../lib/types';

/** מקרא הצבעים: אדום = נמוך, ירוק = גבוה */
export function ColorLegend({ showRanges = true }: { showRanges?: boolean }) {
  const lv: Level[] = [0, 1, 2, 3, 4];
  return (
    <div className="color-legend" aria-label="מקרא צבעים">
      <span className="cl-end">נמוך</span>
      <ol>
        {lv.map((l) => (
          <li key={l} className={`lv lv${l}`}>
            <b>{LEVEL_LABELS[l]}</b>
            {showRanges && <small dir="ltr">{LEVEL_RANGES[l]}</small>}
          </li>
        ))}
      </ol>
      <span className="cl-end">גבוה</span>
    </div>
  );
}

/** תא צבעוני: מספר + תווית רמה (המשמעות אינה נשענת על צבע בלבד) */
export function HeatCell({ v, decimals = false, sub }: { v: number; decimals?: boolean; sub?: string }) {
  const l = levelOf(v);
  return (
    <td className={`heat lv lv${l}`}>
      {sub && <span className="hc-sub">{sub}</span>}
      <span className="hc-v">{decimals ? fmt2(v) : v}</span>
      <span className="hc-l">{LEVEL_LABELS[l]}</span>
    </td>
  );
}

/** מפת צבעים: שורה לכל מיומנות; ארבע שאלות התרגול, ממוצע התרגול והערכה */
export function HeatMap({ m, scores }: { m: Mapping; scores: ScoreMap }) {
  return (
    <div className="table-wrap">
      <table className="heatmap">
        <caption className="sr-only">מפת צבעים של הדירוגים והציונים</caption>
        <thead>
          <tr>
            <th scope="col">מיומנות</th>
            <th scope="col">שאלה 1</th>
            <th scope="col">שאלה 2</th>
            <th scope="col">שאלה 3</th>
            <th scope="col">שאלה 4</th>
            <th scope="col" className="sep">תרגול<br /><small>ממוצע 1–4</small></th>
            <th scope="col">הערכה<br /><small>שאלה 5</small></th>
          </tr>
        </thead>
        <tbody>
          {SKILLS.map((s) => {
            const practice = s.items.filter((i) => i.kind === 'practice');
            const sc = scores[s.key];
            if (!sc) {
              // מיומנות שסומנה כלא רלוונטית: ללא ציונים
              return (
                <tr key={s.key}>
                  <th scope="row">{s.name}</th>
                  <td colSpan={6} className="na-cell">לא רלוונטי</td>
                </tr>
              );
            }
            return (
              <tr key={s.key}>
                <th scope="row">{s.name}</th>
                {practice.map((i) => <HeatCell key={i.code} v={m.answers[i.code] as number} sub={i.dimension} />)}
                <HeatCell v={sc.practice} decimals />
                <HeatCell v={sc.assessment} decimals />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
