import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const empty = fileURLToPath(new URL('./src/admin/stubs/empty.ts', import.meta.url));

// ממשק הרשות כקובץ JS יחיד (dist/admin/admin.js), שמתפרסם ב-GitHub Pages יחד עם האתר.
// דף ה-Apps Script (admin/apps-script/index.html) קטן וקבוע, וטוען את הקובץ הזה: אין צורך להדביק מחדש בכל עדכון,
// ו-HtmlService אינו נוגע בקוד עצמו. הקובץ אינו מכיל נתונים — הם נשלפים מהשרת רק אחרי בדיקת הרשאה.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { html2canvas: empty, dompurify: empty, canvg: empty } },
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    outDir: 'dist/admin',
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 2000,
    lib: { entry: 'src/admin/main.tsx', formats: ['iife'], name: 'SkillsAdmin', fileName: () => 'admin.js' },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
  esbuild: { charset: 'utf8' },
});
