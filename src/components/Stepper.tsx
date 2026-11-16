export type StepState = 'done' | 'partial' | 'todo';

/** סרגל שלבים לניווט: כל שלב זמין הוא כפתור; שלב שאינו זמין עדיין מוסבר בטקסט חלופי */
export function Stepper({ step, labels, states, enabled, reasons, onGo }: {
  step: number;
  labels: string[];
  states: StepState[];
  enabled: boolean[];
  reasons: string[];
  onGo: (i: number) => void;
}) {
  return (
    <nav aria-label="שלבי המיפוי">
      <ol className="stepper">
        {labels.map((l, i) => {
          const cur = i === step;
          const st = states[i];
          const mark = st === 'done' ? '✓' : String(i + 1);
          const status = st === 'done' ? 'הושלם' : st === 'partial' ? 'הושלם חלקית' : 'טרם הושלם';
          return (
            <li key={l} className={`${cur ? 'current' : ''} ${st}`}>
              <button
                type="button"
                onClick={() => !cur && enabled[i] && onGo(i)}
                aria-current={cur ? 'step' : undefined}
                aria-disabled={!enabled[i] || undefined}
                title={!enabled[i] ? reasons[i] : l}
              >
                <span className="dot" aria-hidden="true">{mark}</span>
                <span className="lbl">{l}</span>
                <span className="sr-only">
                  {` (${status}${!enabled[i] && reasons[i] ? `; ${reasons[i]}` : ''})`}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
