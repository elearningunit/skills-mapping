import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { ACADEMIC_YEARS, SKILLS, STUDY_YEARS } from '../config/questionnaire';
import { departmentsOf, FACULTIES } from '../config/units';
import { courseKey, courseLabel, coursesOf, findCourse, hasCatalog, isListedLecturer, lecturersOf } from '../lib/courses';
import type { CourseDetails } from '../lib/types';
import { honeypot } from '../lib/honeypot';
import { normalizeText, validateDetails, type DetailsErrors } from '../lib/validation';

const ORDER: (keyof CourseDetails)[] = ['faculty', 'department', 'academic_year', 'study_year', 'lecturer_name', 'course_name'];

export function StartScreen({ details, onChange, onNext }: {
  details: CourseDetails; onChange: (d: CourseDetails) => void; onNext: () => void;
}) {
  const [errors, setErrors] = useState<DetailsErrors>({});
  const [tried, setTried] = useState(false);
  const deps = details.faculty ? departmentsOf(details.faculty) : [];
  // רשימת קורסים ומרצים למחלקה (אם קיימת). "אחר" = הקלדה ידנית.
  // לפני בחירת מחלקה מוצגות רשימות נעולות ("בחרו קודם מחלקה"); שדות הקלדה — רק במחלקה שאין לה רשימה
  const noDept = !details.department;
  const listed = noDept || hasCatalog(details.department);
  const [lecOtherPicked, setLecOther] = useState(false);
  const [courseOtherPicked, setCourseOther] = useState(false);
  const lecOther = listed && (lecOtherPicked || (!!details.lecturer_name && !isListedLecturer(details.department, details.lecturer_name)));
  const courses = listed ? coursesOf(details.department, lecOther ? '' : details.lecturer_name) : [];
  const course = listed ? findCourse(details.department, lecOther ? '' : details.lecturer_name, details.course_name, details.course_number) : undefined;
  const courseOther = listed && (courseOtherPicked || (!!details.course_name && !course));
  const OTHER = '__other__';

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
            onChange={(e) => { set({ faculty: e.target.value, department: '', lecturer_name: '', course_name: '', course_number: '' }); setLecOther(false); setCourseOther(false); }}>
            <option value="">בחרו פקולטה או בית ספר</option>
            {FACULTIES.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          {err('faculty')}
        </div>

        <div className="field span2">
          <label htmlFor="f-department">מחלקה / בית ספר</label>
          <select id="f-department" value={details.department} disabled={!details.faculty} {...aria('department')}
            onChange={(e) => {
              const department = e.target.value;
              // מעבר למחלקה עם רשימה: בחירה מחדש מתוך הרשימה
              set(hasCatalog(department) ? { department, lecturer_name: '', course_name: '', course_number: '' } : { department, course_number: '' });
              setLecOther(false); setCourseOther(false);
            }}>
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

        {listed ? (
          <>
            <div className="field">
              <label htmlFor={lecOther ? 'f-lecturer_pick' : 'f-lecturer_name'}>שם המרצה</label>
              <select id={lecOther ? 'f-lecturer_pick' : 'f-lecturer_name'} value={lecOther ? OTHER : details.lecturer_name}
                disabled={noDept} {...(lecOther ? {} : aria('lecturer_name'))}
                onChange={(e) => {
                  const v = e.target.value;
                  setLecOther(v === OTHER); setCourseOther(false);
                  set({ lecturer_name: v === OTHER ? '' : v, course_name: '', course_number: '' });
                }}>
                <option value="">{noDept ? 'בחרו קודם מחלקה' : 'בחרו את שמכם'}</option>
                {lecturersOf(details.department).map((l) => <option key={l} value={l}>{l}</option>)}
                <option value={OTHER}>אחר – השם שלי לא ברשימה</option>
              </select>
              {lecOther && (
                <input id="f-lecturer_name" type="text" autoComplete="name" className="other-input" placeholder="הקלידו את שמכם"
                  aria-label="שם המרצה (הקלדה ידנית)" value={details.lecturer_name} {...aria('lecturer_name')}
                  onChange={(e) => set({ lecturer_name: e.target.value })} />
              )}
              {err('lecturer_name')}
            </div>

            <div className="field">
              <label htmlFor={courseOther ? 'f-course_pick' : 'f-course_name'}>שם הקורס</label>
              <select id={courseOther ? 'f-course_pick' : 'f-course_name'} value={courseOther ? OTHER : course ? courseKey(course) : ''}
                disabled={!details.lecturer_name && !lecOther} {...(courseOther ? {} : aria('course_name'))}
                onChange={(e) => {
                  const v = e.target.value;
                  setCourseOther(v === OTHER);
                  const c = courses.find((x) => courseKey(x) === v);
                  // שנה בתואר מהרשימה, רק אם עדיין לא נבחרה
                  set({ course_name: c ? c.name : '', course_number: c ? c.number : '', ...(c?.year && !details.study_year ? { study_year: c.year } : {}) });
                }}>
                <option value="">{noDept ? 'בחרו קודם מחלקה' : details.lecturer_name || lecOther ? 'בחרו קורס' : 'בחרו קודם מרצה'}</option>
                {courses.map((c) => <option key={courseKey(c)} value={courseKey(c)}>{courseLabel(c)}</option>)}
                <option value={OTHER}>אחר – הקורס לא ברשימה</option>
              </select>
              {courseOther && (
                <input id="f-course_name" type="text" autoComplete="off" className="other-input" placeholder="הקלידו את שם הקורס"
                  aria-label="שם הקורס (הקלדה ידנית)" value={details.course_name} {...aria('course_name')}
                  onChange={(e) => set({ course_name: e.target.value, course_number: '' })} />
              )}
              {err('course_name')}
            </div>
          </>
        ) : (
          <>
          <div className="field">
            <label htmlFor="f-lecturer_name">שם המרצה</label>
            <input id="f-lecturer_name" type="text" autoComplete="name" value={details.lecturer_name} {...aria('lecturer_name')}
              onChange={(e) => set({ lecturer_name: e.target.value })} />
            {err('lecturer_name')}
          </div>

          <div className="field">
            <label htmlFor="f-course_name">שם הקורס</label>
            <input id="f-course_name" type="text" autoComplete="off" value={details.course_name} {...aria('course_name')}
              onChange={(e) => set({ course_name: e.target.value, course_number: '' })} />
            {err('course_name')}
          </div>
          </>
        )}

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
