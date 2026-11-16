import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// בנייה לקובץ HTML יחיד ועצמאי (כל ה-JS, ה-CSS והגופנים מוטמעים) — מתאים לכל אחסון סטטי, ללא קריאות רשת.
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  build: { assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 2000 },
  // פלט ASCII בלבד: תווים מיוחדים נכתבים כ-\\u escapes
  esbuild: { charset: 'ascii' },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
