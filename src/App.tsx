import { useEffect, useRef, useState } from 'react';
import { QUESTIONNAIRE_VERSION, SKILLS, TOTAL_ITEMS, type SkillKey } from './config/questionnaire';
import { deleteDraft, loadDraft, saveDraft } from './lib/draft';
import { isoDate, uuid } from './lib/ids';
import type { Answers, CourseDetails, Mapping } from './lib/types';
import { isMappingComplete, missingInSkill, validateDetails } from './lib/validation';
import { StartScreen } from './screens/StartScreen';
import { QuestionnaireScreen } from './screens/QuestionnaireScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { Stepper, type StepState } from './components/Stepper';
import { ConfirmButton } from './components/ConfirmButton';

const EMPTY_DETAILS: CourseDetails = {
  faculty: '', department: '', academic_year: '', study_year: null, lecturer_name: '', course_name: '',
};

export function App() {
  const initial = useRef(loadDraft()).current;
  const [step, setStep] = useState<number>(initial?.step ?? 0);
  const [details, setDetails] = useState<CourseDetails>({ ...EMPTY_DETAILS, ...initial?.details });
  const [answers, setAnswers] = useState<Answers>(initial?.answers ?? {});
  const [notApplicable, setNotApplicable] = useState<SkillKey[]>(initial?.not_applicable ?? []);
  const [assessmentId, setAssessmentId] = useState<string>(initial?.assessment_id ?? uuid());
  const [keepDraft, setKeepDraft] = useState<boolean>(initial !== null);
  const [notice, setNotice] = useState<string>(initial ? 'הטיוטה ששמרתם בדפדפן זה נטענה.' : '');
  const mainRef = useRef<HTMLElement>(null);

  // שמירת טיוטה רק לבקשת המשתמש
  useEffect(() => {
    if (keepDraft) saveDraft({ details, answers, step, assessment_id: assessmentId, not_applicable: notApplicable });
  }, [keepDraft, details, answers, step, assessmentId, notApplicable]);

  // סימון/ביטול "אינה רלוונטית". התשובות שכבר נבחרו נשמרות, כדי שביטול הסימון יחזיר אותן.
  const setSkillNA = (key: SkillKey, on: boolean) =>
    setNotApplicable((cur) => (on ? (cur.includes(key) ? cur : [...cur, key]) : cur.filter((k) => k !== key)));

  const go = (s: number) => {
    setStep(s);
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0 });
      mainRef.current?.querySelector<HTMLElement>('h1, h2')?.focus();
    });
  };

  const toggleDraft = (on: boolean) => {
    setKeepDraft(on);
    if (!on) deleteDraft();
    setNotice(on ? 'הטיוטה תישמר בדפדפן זה בלבד.' : 'שמירת הטיוטה כובתה והטיוטה נמחקה.');
  };

  const removeDraft = () => {
    deleteDraft();
    setKeepDraft(false);
    setNotice('הטיוטה נמחקה מהדפדפן. הנתונים שעל המסך נשארו עד לסגירת הדף.');
  };

  const startNew = () => {
    deleteDraft();
    setKeepDraft(false);
    setDetails(EMPTY_DETAILS);
    setAnswers({});
    setNotApplicable([]);
    setAssessmentId(uuid());
    setNotice('התחלתם מיפוי חדש. הנתונים הקודמים נמחקו.');
    go(0);
  };

  // מצב השלבים לסרגל הניווט העליון
  const detailsOk = Object.keys(validateDetails(details)).length === 0;
  const complete = isMappingComplete(answers, notApplicable);
  const groupState = (i: number): StepState => {
    if (notApplicable.includes(SKILLS[i].key)) return 'done'; // לא רלוונטית = הושלמה
    const miss = missingInSkill(answers, SKILLS[i].key).length;
    return miss === 0 ? 'done' : miss === 5 ? 'todo' : 'partial';
  };
  const RESULTS = SKILLS.length + 1; // שלבים: 0 פרטים, 1..N מיומנויות, N+1 תוצאות
  const needDetails = 'יש להשלים קודם את פרטי הקורס';
  const stepStates: StepState[] = [
    detailsOk ? 'done' : 'todo',
    ...SKILLS.map((_, i) => groupState(i)),
    complete ? 'done' : 'todo',
  ];
  const stepEnabled = [true, ...SKILLS.map(() => detailsOk), detailsOk && complete];
  const stepReasons = [
    '',
    ...SKILLS.map(() => needDetails),
    !detailsOk ? needDetails : `יש לענות על כל ${TOTAL_ITEMS} השאלות`,
  ];

  const mapping: Mapping | null = complete
    ? {
        assessment_id: assessmentId, assessment_date: isoDate(), details, answers,
        not_applicable: SKILLS.map((s) => s.key).filter((k) => notApplicable.includes(k)),
      }
    : null;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <i /><i /><i />
            </span>
            <span>
              <strong>מיפוי מיומנויות בהוראה</strong>
              <small>
                שאלון <span dir="ltr">v{QUESTIONNAIRE_VERSION}</span> · כלי למיפוי עצמי של הקורס
              </small>
            </span>
          </div>
          <Stepper
            step={step}
            labels={['פרטי הקורס', ...SKILLS.map((s) => s.name), 'תוצאות']}
            states={stepStates}
            enabled={stepEnabled}
            reasons={stepReasons}
            onGo={go}
          />
        </div>
      </header>

      <main ref={mainRef} className="main" id="main">
        <div className="live" role="status" aria-live="polite">
          {notice && (
            <p className="notice">
              {notice}
              <button type="button" className="link" onClick={() => setNotice('')}>
                סגירה
              </button>
            </p>
          )}
        </div>

        {step === 0 && (
          <StartScreen details={details} onChange={setDetails} onNext={() => go(1)} />
        )}
        {step >= 1 && step < RESULTS && (
          <QuestionnaireScreen
            key={step}
            skill={SKILLS[step - 1]}
            index={step}
            total={SKILLS.length}
            answers={answers}
            onAnswer={(code, v) => setAnswers((a) => ({ ...a, [code]: v }))}
            notApplicable={notApplicable.includes(SKILLS[step - 1].key)}
            onNotApplicable={(on) => setSkillNA(SKILLS[step - 1].key, on)}
            onBack={() => go(step - 1)}
            onNext={() => go(step + 1)}
            isLast={step === RESULTS - 1}
          />
        )}
        {step === RESULTS && mapping && <ResultsScreen mapping={mapping} onEdit={(s) => go(s)} />}
        {step === RESULTS && !mapping && (
          <section className="card">
            <h2 tabIndex={-1}>חסרים דירוגים</h2>
            <p>יש להשלים את כל {TOTAL_ITEMS} הדירוגים לפני הצגת התוצאות.</p>
            <button className="btn primary" onClick={() => go(1)}>חזרה לשאלון</button>
          </section>
        )}

        <section className="privacy" aria-labelledby="privacy-h">
          <h2 id="privacy-h" className="privacy-h">פרטיות ושמירה</h2>
          <p>
            המערכת אינה שולחת נתונים באופן אוטומטי: הדוח וקובץ ה-CSV נוצרים בדפדפן שלכם. אפשר לשמור טיוטה בדפדפן זה (כולל שם המרצה ושם הקורס)
            כדי להמשיך מאוחר יותר. במחשב משותף, משתמשים אחרים באותו דפדפן עלולים לראות את הטיוטה; מחקו אותה בסיום.
          </p>
          <div className="privacy-actions">
            <label className="switch">
              <input
                id="keep-draft"
                type="checkbox"
                checked={keepDraft}
                onChange={(e) => toggleDraft(e.target.checked)}
              />
              <span>שמירת טיוטה בדפדפן זה</span>
            </label>
            <button type="button" className="btn ghost" onClick={removeDraft}>
              מחיקת טיוטה
            </button>
            <ConfirmButton className="btn ghost" confirmLabel="לאישור לחצו שוב" onConfirm={startNew}>
              התחלת מיפוי חדש
            </ConfirmButton>
          </div>
        </section>
      </main>
    </div>
  );
}
