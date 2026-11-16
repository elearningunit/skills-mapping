import pairs from './faculties_departments.json';

export interface UnitPair { faculty: string; department: string }
export const UNIT_PAIRS: UnitPair[] = pairs;

/** פקולטות ייחודיות לפי סדר הופעתן בקובץ המקור */
export const FACULTIES: string[] = [...new Set(UNIT_PAIRS.map((p) => p.faculty))];

export function departmentsOf(faculty: string): string[] {
  return UNIT_PAIRS.filter((p) => p.faculty === faculty).map((p) => p.department);
}
