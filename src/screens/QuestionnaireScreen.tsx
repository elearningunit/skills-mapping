import { useState } from 'react';
import { ANCHORS, INSTRUCTIONS, SCALE, type ItemCode, type Rating, type Skill } from '../config/questionnaire';
import type { Answers } from '../lib/types';
import { missingInSkill } from '../lib/validation';

/** המחוון מוצג לפני השאלות שהוא חל עליהן: מחוון תרגול לפני שאלות 1–4, מחוון הערכה לפני שאלה 5 */
function Rubric({ kind, id }: { kind: 'practice' | 'assessment'; id: string }) {
  return (
    <details className={`rubric ${kind}`} open>
      <summary id={id}>
        {kind === 'practice'
          ? 'מה משמעות הציונים? מחוון לשאלות 1–4 (תרגול)'
          : 'מה משמעות הציונים? מחוון לשאלה 5 (הערכה)'}
      </summary>
      <ol className="rubric-list">
        {SCALE.map((n) => (
          <li key={n}>
            <b className="rubric-n">{n}</b>
            <span>{kind === 'practice' ? ANCHORS[n].practice : ANCHORS[n].assessment}</span>
          </li>
        ))}
      </ol>
      {kind === 'practice' && (
        <p className="hint">0 הוא תשובה תקפה. הדירוג מתייחס לקורס ולא לרמת היכולת של הסטודנטים.</p>
      )}
    </details>
  );
}

export function QuestionnaireScreen({ skill, index, total, answers, onAnswer, notApplicable, onNotApplicable, onBack, onNext, isLast }: {
  skill: Skill; index: number; total: number; answers: Answers;
  onAnswer: (code: ItemCode, v: Rating) => void;
  notApplicable: boolean; onNotApplicable: (on: boolean) => void;
  onBack: () => void; onNext: () => void; isLast: boolean;
}) {
  const [showMissing, setShowMissing] = useState(false);
  const missing = missingInSkill(answers, skill.key);
  const answered = skill.items.length - missing.length;

  const next = () => {
    if (!notApplicable && missing.length) {
      setShowMissing(true);
      document.querySelector<HTMLInputElement>(`input[name="q-${missing[0]}"]`)?.focus();
      return;
    }
    onNext();
  };

  return (
    <section className="card" aria-labelledby="q-h">
      <p className="eyebrow">שלב {index + 1} מתוך {total + 2} · מיומנות {index} מתוך {total}</p>
      <h1 id="q-h" tabIndex={-1}>{skill.name}</h1>
      {/* הגדרת המיומנות: מידע מסייע בלבד, אינה חלק מהשאלון או מהחישוב */}
      <div className="skill-def" aria-label={`הגדרה: ${skill.name}`}>
        <p>{skill.definition[0]}</p>
        <p>{skill.definition[1]}</p>
      </div>

      {/* "לא רלוונטי": מסתיר את היגדי המיומנות הזו בלבד; ניתן לבטל בכל שלב */}
      <label className="na-toggle" htmlFor={`na-${skill.key}`}>
        <input id={`na-${skill.key}`} type="checkbox" checked={notApplicable}
          onChange={(e) => { setShowMissing(false); onNotApplicable(e.target.checked); }} />
        <span>מיומנות זו אינה רלוונטית לקורס שלי</span>
      </label>

      {notApplicable ? (
        <p className="na-note" role="status">
          המיומנות סומנה כלא רלוונטית ולא יחושב לה ציון. אפשר להמשיך למיומנות הבאה, או לבטל את הסימון כדי לענות על ההיגדים.
        </p>
      ) : (
      <>
      <p className="lead small">{INSTRUCTIONS}</p>

      <ol className="questions">
        {skill.items.map((item, qi) => {
          const v = answers[item.code];
          const isMissing = showMissing && v === undefined;
          const rubricId = `rub-${skill.key}-${item.kind}`;
          const anchors = (n: Rating) => (item.kind === 'practice' ? ANCHORS[n].practice : ANCHORS[n].assessment);
          return (
            <li key={item.code} className="q-wrap">
              {qi === 0 && <Rubric kind="practice" id={rubricId} />}
              {item.kind === 'assessment' && <Rubric kind="assessment" id={rubricId} />}
              <div className={`q ${item.kind} ${isMissing ? 'missing' : ''}`}>
                <fieldset aria-describedby={isMissing ? `m-${item.code}` : undefined}>
                  <legend>
                    <span className="qmeta">
                      <span className="code" dir="ltr">{item.code}</span>
                      <span>{item.dimension}</span>
                      {item.kind === 'assessment' && <span className="tag">שאלת הערכה</span>}
                    </span>
                    <span className="qtext">{qi + 1}. {item.text}</span>
                  </legend>
                  <div className="seg">
                    {SCALE.map((n) => (
                      <label key={n} className={v === n ? 'on' : ''} title={anchors(n)}>
                        <input type="radio" name={`q-${item.code}`} value={n} checked={v === n}
                          aria-label={`${n}: ${anchors(n)}`}
                          onChange={() => onAnswer(item.code, n)} />
                        <span aria-hidden="true">{n}</span>
                      </label>
                    ))}
                  </div>
                  {isMissing && <p className="missing-msg" id={`m-${item.code}`}>יש לבחור דירוג לשאלה זו.</p>}
                </fieldset>
              </div>
            </li>
          );
        })}
      </ol>

      </>
      )}

      {!notApplicable && showMissing && missing.length > 0 && (
        <div className="error-summary" role="alert">
          חסרים דירוגים לשאלות: <span dir="ltr">{missing.join(', ')}</span>. 0 הוא תשובה תקפה.
        </div>
      )}

      <div className="actions between">
        <button type="button" className="btn ghost" onClick={onBack}>הקודם</button>
        <span className="progress" aria-live="polite">{notApplicable ? 'לא רלוונטי' : `${answered} מתוך 5 נענו`}</span>
        <button type="button" className="btn primary" onClick={next}>{isLast ? 'הצגת תוצאות' : 'הבא'}</button>
      </div>
    </section>
  );
}
