import { SKILLS, TOTAL_ITEMS } from '../config/questionnaire';
import { PrivacyNotice } from '../components/PrivacyNotice';

/** עמוד פתיחה: מטרת המיפוי, הבהרה שאין זו הערכת מרצים, והודעת הפרטיות. פרטי הקורס — בעמוד הבא. */
export function IntroScreen({ onStart, resuming }: { onStart: () => void; resuming: boolean }) {
  return (
    <section className="card intro" aria-labelledby="intro-h">
      <h1 id="intro-h" tabIndex={-1}>מיפוי מיומנויות בהוראה</h1>
      <p className="lead">
        המיפוי בוחן באיזו מידה הקורס דורש מהסטודנטים לתרגל ארבע מיומנויות: {SKILLS.map((s) => s.name).join('; ')},
        והאם הן מוערכות באופן מובנה. {TOTAL_ITEMS} שאלות, כרבע שעה. בסוף תקבלו דוח אישי בקובץ PDF וקובץ CSV.
      </p>

      <aside className="intro-note" aria-labelledby="note-h">
        <h2 id="note-h">חשוב לדעת</h2>
        <p>
          המיפוי אינו כלי להערכת מרצים. מטרתו לקבל תמונת מצב של תכנית הלימודים המחלקתית. כדי שהתמונה תהיה מדויקת,
          ענו לפי מה שקורה בקורס בפועל. גם דירוג נמוך של מיומנות הוא מידע חשוב.
        </p>
      </aside>

      <PrivacyNotice />

      <div className="actions">
        <button type="button" className="btn primary" onClick={onStart}>
          {resuming ? 'המשך המיפוי' : 'התחלת המיפוי'}
        </button>
      </div>
    </section>
  );
}
