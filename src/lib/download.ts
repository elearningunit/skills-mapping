// הורדת קובץ: בתוך עמוד Artifact של claude.ai דרך יכולת downloads; מחוץ לו — הורדה רגילה בדפדפן.
type DownloadsNs = { save(r: { filename: string; data: string | Blob }): Promise<unknown> };
type ClaudeGlobal = { use?(name: string): Promise<unknown> };

let nsPromise: Promise<DownloadsNs | null> | null = null;

function hostDownloads(): Promise<DownloadsNs | null> {
  if (!nsPromise) {
    const c = (globalThis as unknown as { claude?: ClaudeGlobal }).claude;
    nsPromise = c?.use ? (c.use('downloads') as Promise<DownloadsNs | null>).catch(() => null) : Promise.resolve(null);
  }
  return nsPromise;
}

export type DownloadResult = 'saved' | 'declined' | 'failed';

export async function downloadFile(filename: string, data: Blob): Promise<DownloadResult> {
  const ns = await hostDownloads();
  if (ns) {
    try {
      await ns.save({ filename, data });
      return 'saved';
    } catch (e) {
      const code = (e as { code?: string })?.code;
      return code === 'declined' ? 'declined' : 'failed';
    }
  }
  try {
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return 'saved';
  } catch {
    return 'failed';
  }
}
