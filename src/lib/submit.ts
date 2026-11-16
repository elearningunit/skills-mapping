import { CSV_COLUMNS, mappingToRow } from './csv';
import type { Mapping } from './types';

/** המיפוי נשלח באותו מבנה בדיוק כמו שורת ה-CSV (40 עמודות) */
export function buildPayload(m: Mapping): { row: Record<string, string | number> } {
  const values = mappingToRow(m);
  return { row: Object.fromEntries(CSV_COLUMNS.map((c, i) => [c, values[i]])) };
}

export type SubmitResult = 'ok' | 'rejected' | 'sent_unconfirmed' | 'failed';

/**
 * שליחה לקולט. גוף text/plain כדי למנוע בקשת preflight (Apps Script אינו תומך בה).
 * שליחה חוזרת של אותו מיפוי מעדכנת את השורה בגיליון ואינה יוצרת כפילות.
 */
export async function submitMapping(url: string, m: Mapping, fetchImpl: typeof fetch = fetch): Promise<SubmitResult> {
  const init: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(buildPayload(m)),
    redirect: 'follow',
  };
  try {
    const res = await fetchImpl(url, init);
    const data = (await res.json()) as { ok?: boolean };
    return data.ok ? 'ok' : 'rejected';
  } catch {
    // אם הדפדפן אינו מאפשר לקרוא את התשובה, שולחים בלי לקרוא אותה
    try {
      await fetchImpl(url, { ...init, mode: 'no-cors' });
      return 'sent_unconfirmed';
    } catch {
      return 'failed';
    }
  }
}
