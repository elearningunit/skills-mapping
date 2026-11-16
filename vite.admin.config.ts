import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// בניית ממשק הרשות לקובץ HTML יחיד (מוגש מ-Apps Script). במצב demo נכללים נתוני דוגמה בדויים לתצוגה מקומית.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: mode === 'demo' ? 'dist-admin-demo' : 'dist-admin',
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 2000,
    modulePreload: false,
    rollupOptions: { input: mode === 'demo' ? 'admin-demo.html' : 'admin.html' },
  },
  esbuild: { charset: 'ascii' },
}));
