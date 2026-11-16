import { forwardRef } from 'react';
import type { Mapping } from '../lib/types';
import type { Recommendation } from '../lib/recommendations';
import type { ScoreMap } from '../lib/scoring';
import { buildInsights } from '../lib/insights';
import { QUESTIONNAIRE_VERSION } from '../config/questionnaire';
import { ScoreChart } from './ScoreChart';
import { DetailsList } from './ReportParts';
import { ColorLegend, HeatMap } from './Heat';

/** שני עמודי A4 (794×1123 פיקסלים) המצוירים ל-PDF. עמוד 1: פרופיל ציונים; עמוד 2: תובנות והמלצות. */
export const PdfReport = forwardRef<HTMLDivElement, {
  m: Mapping; scores: ScoreMap; recs: Recommendation[];
}>(function PdfReport({ m, scores, recs }, ref) {
  return (
    <div ref={ref} className="pdf-root" aria-hidden="true" dir="rtl">
      <div className="pdf-page">
        <header className="pdf-head">
          <div>
            <p className="eyebrow">דוח מיפוי מיומנויות בהוראה</p>
            <h1>{m.details.course_name}</h1>
          </div>
          <span className="pdf-pg">עמוד 1 מתוך 2</span>
        </header>
        <DetailsList m={m} />
        <h2>פרופיל ציונים</h2>
        <ScoreChart scores={scores} idPrefix="pdf" />
        <h2>פירוט לפי שאלות</h2>
        <ColorLegend />
        <HeatMap m={m} scores={scores} />
        <p className="pdf-foot">
          דיווח עצמי של המרצה על ההוראה וההערכה בקורס. אין זו בדיקה ישירה של רכישת מיומנויות אצל הסטודנטים. אין ציון כולל.
        </p>
      </div>
      <div className="pdf-page">
        <header className="pdf-head">
          <div>
            <p className="eyebrow">{m.details.course_name} · {m.details.lecturer_name}</p>
            <h1>תובנות והמלצות</h1>
          </div>
          <span className="pdf-pg">עמוד 2 מתוך 2</span>
        </header>
        <h2>תובנות</h2>
        <ul className="insights rich">
          {buildInsights(m.answers, undefined, m.not_applicable).map((i) => <li key={i.id}><b>{i.title}.</b> {i.text}</li>)}
        </ul>
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
  );
});
