// תקשורת עם צד השרת של ממשק הרשות (Apps Script) דרך google.script.run.
// מחוץ ל-Apps Script (תצוגה מקומית / בדיקות) אפשר להזריק מימוש חלופי ב-window.__ADMIN_API__.
import type { Action, AdminData } from './model';

export interface AdminApi {
  listMappings(): Promise<AdminData>;
  setDecision(id: string, action: Action, note: string): Promise<{ ok: boolean }>;
}

type Runner = {
  withSuccessHandler(fn: (v: unknown) => void): Runner;
  withFailureHandler(fn: (e: { message?: string }) => void): Runner;
  [fn: string]: unknown;
};

declare global {
  interface Window {
    google?: { script?: { run?: Runner } };
    __ADMIN_API__?: AdminApi;
  }
}

function call<T>(name: string, ...args: unknown[]): Promise<T> {
  return new Promise((resolve, reject) => {
    const run = window.google!.script!.run!
      .withSuccessHandler((v) => resolve(v as T))
      .withFailureHandler((e) => reject(new Error(e?.message || 'שגיאה בשרת')));
    (run[name] as (...a: unknown[]) => void)(...args);
  });
}

export function getApi(): AdminApi | null {
  if (window.__ADMIN_API__) return window.__ADMIN_API__;
  if (window.google?.script?.run) {
    return {
      listMappings: () => call<AdminData>('listMappings'),
      setDecision: (id, action, note) => call<{ ok: boolean }>('setDecision', id, action, note),
    };
  }
  return null;
}
