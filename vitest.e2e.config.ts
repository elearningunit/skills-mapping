import { defineConfig } from 'vitest/config';

// בדיקות דפדפן (Playwright) מול הקובץ הבנוי dist/index.html. הרצה: npm run build && npm run test:e2e
export default defineConfig({
  test: {
    include: ['tests/e2e/**/*.e2e.ts'],
    environment: 'node',
    testTimeout: 90_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
