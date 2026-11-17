// רשימת הקורסים והמרצים לבחירה בממשק המרצה (נוצרת מ-data/courses.csv על ידי scripts/gen-courses.mjs).
// מחלקה שאין לה רשימה — המרצה מקליד שם מרצה ושם קורס ידנית, כמו קודם.
import raw from '@courses';

export interface CatalogCourse { number: string; name: string; year: number | null }
type DeptRaw = { courses: [string, string, number | null][]; lecturers: [string, number[]][] };
export type Catalog = Record<string, DeptRaw>;

let catalog: Catalog = raw as unknown as Catalog;

/** לבדיקות בלבד */
export function setCatalog(c: Catalog): void { catalog = c; }

const toCourse = ([number, name, year]: [string, string, number | null]): CatalogCourse => ({ number, name, year });
const key = (s: string) => s.replace(/\s+/g, ' ').trim();

export function hasCatalog(department: string): boolean {
  return !!catalog[department]?.courses.length;
}

export function lecturersOf(department: string): string[] {
  return catalog[department]?.lecturers.map(([l]) => l) ?? [];
}

/** הקורסים של המרצה; מרצה שאינו ברשימה ("אחר") — כל קורסי המחלקה */
export function coursesOf(department: string, lecturer = ''): CatalogCourse[] {
  const d = catalog[department];
  if (!d) return [];
  const hit = d.lecturers.find(([l]) => key(l) === key(lecturer));
  return hit ? hit[1].map((i) => toCourse(d.courses[i])) : d.courses.map(toCourse);
}

export function isListedLecturer(department: string, lecturer: string): boolean {
  return !!lecturer && lecturersOf(department).some((l) => key(l) === key(lecturer));
}

export function findCourse(department: string, lecturer: string, course: string): CatalogCourse | undefined {
  return course ? coursesOf(department, lecturer).find((c) => key(c.name) === key(course)) : undefined;
}

/** תווית ברשימה: שם הקורס ומספרו, כדי להבחין בין קורסים בעלי שם דומה */
export function courseLabel(c: CatalogCourse): string {
  return c.number ? `${c.name} (${c.number})` : c.name;
}
