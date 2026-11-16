import { SKILLS } from '../config/questionnaire';
import { LEVEL_LABELS, levelOf } from '../lib/levels';
import { fmt2, type ScoreMap } from '../lib/scoring';

/** שם מיומנות ארוך נשבר לשתי שורות ליד הרווח הקרוב לאמצע */
function labelLines(name: string): string[] {
  if (name.length <= 14) return [name];
  const mid = name.length / 2;
  let best = -1;
  for (let i = 0; i < name.length; i++) if (name[i] === ' ' && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  return best < 0 ? [name] : [name.slice(0, best), name.slice(best + 1)];
}

/** תרשים עמודות אופקי, סקאלה 0–4. צבע העמודה = רמה (אדום נמוך → ירוק גבוה). הערכה: עמודה מקווקוות. */
export function ScoreChart({ scores, idPrefix = 'c' }: { scores: ScoreMap; idPrefix?: string }) {
  const W = 600, labelW = 120, valueW = 120, rowH = 26, gapRow = 6, groupGap = 22, top = 8, axisH = 22;
  const plotW = W - labelW - valueW;
  const x = (v: number) => (v / 4) * plotW;
  const groupH = rowH * 2 + gapRow;
  const H = top + SKILLS.length * groupH + (SKILLS.length - 1) * groupGap + axisH + 4;
  const right = W - labelW;
  const pat = `${idPrefix}-hatch`;

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${idPrefix}-title`} direction="ltr" style={{ direction: 'ltr' }}>
        <title id={`${idPrefix}-title`}>
          {SKILLS.map((s) => { const sc = scores[s.key]; return sc ? `${s.name}: תרגול ${fmt2(sc.practice)}, הערכה ${fmt2(sc.assessment)}` : `${s.name}: לא רלוונטי`; }).join('; ')}
        </title>
        <defs>
          <pattern id={pat} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="2.5" height="7" fill="var(--hatch)" />
          </pattern>
        </defs>
        {[0, 1, 2, 3, 4].map((t) => (
          <g key={t}>
            <line x1={right - x(t)} x2={right - x(t)} y1={top - 4} y2={H - axisH} stroke="var(--grid)" strokeWidth="1" />
            <text x={right - x(t)} y={H - 6} textAnchor="middle" className="tick" fill="var(--muted)">{t}</text>
          </g>
        ))}
        {SKILLS.map((s, i) => {
          const sc = scores[s.key];
          const y0 = top + i * (groupH + groupGap);
          const label = (
            <text x={W - 2} y={y0 + groupH / 2 + 5} textAnchor="end" className="glabel" fill="var(--fg)">
              {labelLines(s.name).map((ln, li, arr) => (
                <tspan key={li} x={W - 2} dy={li === 0 ? -(arr.length - 1) * 8 : 17}>{ln}</tspan>
              ))}
            </text>
          );
          // מיומנות שסומנה כלא רלוונטית: ללא עמודות וללא ציון
          if (!sc) {
            return (
              <g key={s.key}>
                {label}
                <rect x={right - plotW} y={y0} width={plotW} height={groupH} fill="var(--track)" rx="3" />
                <text x={right - plotW / 2} y={y0 + groupH / 2 + 5} textAnchor="middle" className="na-text" fill="var(--muted)">לא רלוונטי</text>
              </g>
            );
          }
          const rows = [
            { v: sc.practice, label: 'תרגול', hatch: false },
            { v: sc.assessment, label: 'הערכה', hatch: true },
          ];
          return (
            <g key={s.key}>
              {label}
              {rows.map((r, j) => {
                const y = y0 + j * (rowH + gapRow);
                const w = Math.max(x(r.v), 0);
                const l = levelOf(r.v);
                return (
                  <g key={j}>
                    <rect x={right - plotW} y={y} width={plotW} height={rowH} fill="var(--track)" rx="3" />
                    {w > 0 && <rect x={right - w} y={y} width={w} height={rowH} fill={`var(--lv${l})`} rx="3" />}
                    {w > 0 && r.hatch && <rect x={right - w} y={y} width={w} height={rowH} fill={`url(#${pat})`} rx="3" />}
                    {w > 0 && <rect x={right - w} y={y} width={w} height={rowH} fill="none" stroke={`var(--lv${l}-edge)`} rx="3" />}
                    <text x={right - plotW - 8} y={y + rowH / 2 + 5} textAnchor="end" className="val" fill="var(--fg)">
                      {`${fmt2(r.v)} · ${LEVEL_LABELS[l]}`}
                    </text>
                    <text x={right - 6} y={y + rowH / 2 + 4} textAnchor="end" className="inbar"
                      fill={w > 48 ? 'var(--lv-ink)' : 'var(--muted)'}>
                      {r.label}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      <figcaption className="legend">
        <span><i className="sw solid" aria-hidden="true" /> תרגול (ממוצע שאלות 1–4)</span>
        <span><i className="sw hatched" aria-hidden="true" /> הערכה (שאלה 5)</span>
        <span className="muted">צבע העמודה מציין את הרמה; סולם 0–4</span>
      </figcaption>
    </figure>
  );
}
