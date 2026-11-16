// טעינת ספריות ה-PDF.
// בנייה רגילה (index.html): הספריות ארוזות בקובץ — אין קריאות רשת.
// בניית Artifact (mode=artifact): הספריות אינן ארוזות, כדי שהדף יהיה קטן; הן נטענות מ-jsDelivr
// רק בלחיצה על "הורדת PDF", עם גיבוב integrity שמחושב בזמן הבנייה מהקבצים המקומיים.

type JsPdfCtor = typeof import('jspdf').jsPDF;
type ToJpeg = typeof import('html-to-image').toJpeg;

export interface PdfLibs { jsPDF: JsPdfCtor; toJpeg: ToJpeg }

declare const __PDF_CDN__: { src: string; integrity: string }[];

const scriptCache = new Map<string, Promise<void>>();

function loadScript(src: string, integrity: string): Promise<void> {
  let p = scriptCache.get(src);
  if (!p) {
    p = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.integrity = integrity;
      s.crossOrigin = 'anonymous';
      s.onload = () => resolve();
      s.onerror = () => { scriptCache.delete(src); s.remove(); reject(new Error(`failed to load ${src}`)); };
      document.head.appendChild(s);
    });
    scriptCache.set(src, p);
  }
  return p;
}

export async function loadPdfLibs(): Promise<PdfLibs> {
  if (import.meta.env.MODE === 'artifact') {
    for (const lib of __PDF_CDN__) await loadScript(lib.src, lib.integrity);
    const g = globalThis as unknown as { jspdf?: { jsPDF: JsPdfCtor }; htmlToImage?: { toJpeg: ToJpeg } };
    if (!g.jspdf?.jsPDF || !g.htmlToImage?.toJpeg) throw new Error('PDF libraries unavailable');
    return { jsPDF: g.jspdf.jsPDF, toJpeg: g.htmlToImage.toJpeg };
  }
  const [{ jsPDF }, { toJpeg }] = await Promise.all([import('jspdf'), import('html-to-image')]);
  return { jsPDF, toJpeg };
}
