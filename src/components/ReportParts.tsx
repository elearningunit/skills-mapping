import { QUESTIONNAIRE_VERSION, STUDY_YEARS } from '../config/questionnaire';
import type { Mapping } from '../lib/types';

export function yearLabel(y: number | null) {
  return STUDY_YEARS.find((s) => s.value === y)?.label ?? '';
}

export function formatDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export function DetailsList({ m }: { m: Mapping }) {
  const d = m.details;
  const rows: [string, string, boolean?][] = [
    ['שם המרצה', d.lecturer_name],
    ['שם הקורס', d.course_name],
    ['פקולטה / בית ספר', d.faculty],
    ['מחלקה / בית ספר', d.department],
    ['שנה אקדמית', d.academic_year],
    ['שנת לימודים בתואר', yearLabel(d.study_year)],
    ['תאריך מיפוי', formatDate(m.assessment_date)],
    ['גרסת שאלון', QUESTIONNAIRE_VERSION, true],
  ];
  return (
    <dl className="details">
      {rows.map(([k, v, ltr]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd dir={ltr ? 'ltr' : undefined}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
