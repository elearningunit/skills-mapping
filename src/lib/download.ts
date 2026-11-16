// הורדת קובץ שנוצר בדפדפן (PDF / CSV).
export type DownloadResult = 'saved' | 'failed';

export async function downloadFile(filename: string, data: Blob): Promise<DownloadResult> {
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
