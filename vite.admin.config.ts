import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath } from 'node:url';

const empty = fileURLToPath(new URL('./src/admin/stubs/empty.ts', import.meta.url));

// בניית ממשק הרשות לקובץ HTML יחיד (מוגש מ-Apps Script). במצב demo נכללים נתוני דוגמה בדויים לתצוגה מקומית.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), viteSingleFile()],
  // jsPDF טוען אותם רק עבור doc.html() / SVG — לא בשימוש כאן (הדוח נארז כתמונות JPEG)
  resolve: { alias: { html2canvas: empty, dompurify: empty, canvg: empty } },
  build: {
    outDir: mode === 'demo' ? 'dist-admin-demo' : 'dist-admin',
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 2000,
    modulePreload: false,
    rollupOptions: { input: mode === 'demo' ? 'admin-demo.html' : 'admin.html' },
  },
  esbuild: { charset: 'ascii' },
}));
