import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

const require = createRequire(import.meta.url);

/** ספריות ה-PDF לגרסת ה-Artifact: אותו קובץ בדיוק כמו בחבילת npm המקומית, עם גיבוב SRI */
function cdnLib(pkg: string, file: string) {
  const version = require(`${pkg}/package.json`).version as string;
  const bytes = readFileSync(require.resolve(`${pkg}/${file}`));
  return {
    src: `https://cdn.jsdelivr.net/npm/${pkg}@${version}/${file}`,
    integrity: 'sha384-' + createHash('sha384').update(bytes).digest('base64'),
  };
}

// בנייה לקובץ HTML יחיד ועצמאי (כל ה-JS, ה-CSS והגופנים מוטמעים) — מתאים לכל אחסון סטטי.
// במצב artifact ספריות ה-PDF אינן נארזות (ראו src/lib/pdfLibs.ts).
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), viteSingleFile()],
  define: {
    __PDF_CDN__: JSON.stringify(
      mode === 'artifact'
        ? [cdnLib('jspdf', 'dist/jspdf.umd.min.js'), cdnLib('html-to-image', 'dist/html-to-image.js')]
        : [],
    ),
  },
  build: { assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 2000 },
  // פלט ASCII בלבד: תווים מיוחדים נכתבים כ-\\u escapes
  esbuild: { charset: 'ascii' },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
}));
