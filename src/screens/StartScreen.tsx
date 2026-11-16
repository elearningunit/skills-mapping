import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { ACADEMIC_YEARS, SKILLS, STUDY_YEARS, TOTAL_ITEMS } from '../config/questionnaire';
import { departmentsOf, FACULTIES } from '../config/units';
import type { CourseDetails } from '../lib/types';
import { PrivacyNotice } from '../components/PrivacyNotice';
import { honeypot } from '../lib/honeypot';
import { normalizeText, validateDetails, type DetailsErrors } from '../lib/validation';

const ORDER: (keyof CourseDetails)[] = ['faculty', 'department', 'academic_year', 'study_year', 'lecturer_name', 'course_name'];

export function StartScreen({ details, onChange, onNext }: {
  details: CourseDetails; onChange: (d: CourseDetails) => void; onNext: () => void;
}) {
  const [errors, setErrors] = useState<DetailsErrors>({});
  const [tried, setTried] = useState(false);
  const deps = details.faculty ? departmentsOf(details.faculty) : [];

  const set = (patch: Partial<CourseDetails>) => {
    const next = { ...details, ...patch };
    onChange(next);
    if (tried) setErrors(validateDetails(next));
  };

  // לא נשענים על שליחת טופס: בחלק מהמסגרות המוגבלות (sandbox) הדפדפן חוסם אותה בשקט
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const clean = { ...details, lecturer_name: normalizeText(details.lecturer_name), course_name: normalizeText(details.course_name) };
    onChange(clean);
    const errs = validateDetails(clean);
    setErrors(errs);
    setTried(true);
    const first = ORDER.find((k) => errs[k]);
    if (first) {
      document.getElementById(`f-${first}`)?.focus();
      return;
    }
    onNext();
  };

  const err = (k: keyof CourseDetails) =>
    errors[k] ? <p className="field-error" id={`e-${k}`}>{errors[k]}</p> : null;
  const aria = (k: keyof CourseDetails) => ({
    'aria-invalid': errors[k] ? true : undefined,
    'aria-describedby': errors[k] ? `e-${k}` : undefined,
    'aria-required': true,
  });
  const errCount = Object.keys(errors).length;

  return (
    <section className="card" aria-labelledby="start-h">
      <p className="eyebrow">שלב 1 מתוך {SKILLS.length + 2}</p>
      <h1 id="start-h" tabIndex={-1}>פרטי הקורס</h1>
      <p className="lead">
        המיפוי בוחן באיזו מידה הקורס דורש מהסטודנטים לתרגל ארבע מיומנויות: {SKILLS.map((s) => s.name).join('; ')},
        והאם הן מוערכות באופן מובנה. {TOTAL_ITEMS} שאלות, כרבע שעה. בסוף תקבלו דוח אישי בקובץ PDF וקובץ CSV.
      </p>

      <PrivacyNotice />

      {tried && errCount > 0 && (
        <div className="error-summary" role="alert">
          חסרים {errCount} מתוך {ORDER.length} פרטים. כל השדות חובה.
        </div>
      )}

      <form onSubmit={submit} noValidate className="form-grid"
        onKeyDown={(e: KeyboardEvent<HTMLFormElement>) => {
          if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') { e.preventDefault(); submit(); }
        }}>
        <div className="field span2">
          <label htmlFor="f-faculty">פקולטה / בית ספר</label>
          <select id="f-faculty" value={details.faculty} {...aria('faculty')}
            onChange={(e) => set({ faculty: e.target.value, department: '' })}>
            <option value="">בחרו פקולטה או בית ספר</option>
            {FACULTIES.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          {err('faculty')}
        </div>

        <div className="field span2">
          <label htmlFor="f-department">מחלקה / בית ספר</label>
          <select id="f-department" value={details.department} disabled={!details.faculty} {...aria('department')}
            onChange={(e) => set({ department: e.target.value })}>
            <option value="">{details.faculty ? 'בחרו מחלקה' : 'בחרו קודם פקולטה'}</option>
            {deps.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          {err('department')}
        </div>

        <div className="field">
          <label htmlFor="f-academic_year">שנת לימודים אקדמית</label>
          <select id="f-academic_year" value={details.academic_year} {...aria('academic_year')}
            onChange={(e) => set({ academic_year: e.target.value })}>
            <option value="">בחרו שנה אקדמית</option>
            {ACADEMIC_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          {err('academic_year')}
        </div>

        <div className="field">
          <label htmlFor="f-study_year">שנת לימודים בתואר</label>
          <select id="f-study_year" value={details.study_year ?? ''} {...aria('study_year')}
            onChange={(e) => set({ study_year: e.target.value ? Number(e.target.value) : null })}>
            <option value="">בחרו שנה</option>
            {STUDY_YEARS.map((y) => <option key={y.value} value={y.value}>{y.label}</option>)}
          </select>
          <p className="hint">השנה בתואר שבה נלמד הקורס (א׳–ה׳).</p>
          {err('study_year')}
        </div>

        <div className="field">
          <label htmlFor="f-lecturer_name">שם המרצה</label>
          <input id="f-lecturer_name" type="text" autoComplete="name" value={details.lecturer_name} {...aria('lecturer_name')}
            onChange={(e) => set({ lecturer_name: e.target.value })} />
          {err('lecturer_name')}
        </div>

        <div className="field">
          <label htmlFor="f-course_name">שם הקורס</label>
          <input id="f-course_name" type="text" autoComplete="off" value={details.course_name} {...aria('course_name')}
            onChange={(e) => set({ course_name: e.target.value })} />
          {err('course_name')}
        </div>

        {/* שדה נסתר נגד בוטים: מוסתר מהמסך, מקורא המסך ומהניווט במקלדת */}
        <div className="hp-field" aria-hidden="true">
          <label htmlFor="f-website">אתר אינטרנט</label>
          <input id="f-website" name="website" type="text" tabIndex={-1} autoComplete="off"
            defaultValue="" onChange={(e) => { honeypot.value = e.target.value; }} />
        </div>

        <div className="actions span2">
          <button type="button" className="btn primary" onClick={() => submit()}>המשך לשאלון</button>
        </div>
      </form>
    </section>
  );
}
