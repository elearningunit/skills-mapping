import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// רשימת הקורסים: ברירת המחדל היא src/config/courses.json; בבדיקות אפשר להחליף בקובץ דוגמה (COURSES_JSON)
const courses = process.env.COURSES_JSON
  ? resolve(process.env.COURSES_JSON)
  : fileURLToPath(new URL('./src/config/courses.json', import.meta.url));

// בנייה לקובץ HTML יחיד ועצמאי (כל ה-JS, ה-CSS והגופנים מוטמעים) — מתאים לכל אחסון סטטי, ללא קריאות רשת.
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  resolve: { alias: { '@courses': courses } },
  build: { assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 2000 },
  // פלט ASCII בלבד: תווים מיוחדים נכתבים כ-\\u escapes
  esbuild: { charset: 'ascii' },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
