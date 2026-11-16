// יצירת PDF בצד הלקוח: כל עמוד A4 מצויר על ידי הדפדפן (עברית ו-RTL תקינים) ונארז כתמונה בעמוד PDF.
import { FONT_CSS } from '../fonts';

export async function buildPdf(pages: HTMLElement[]): Promise<Blob> {
  // הספריות ארוזות בקובץ האתר; נטענות רק בלחיצה על "הורדת דוח PDF"
  const [{ jsPDF }, { toJpeg }] = await Promise.all([import('jspdf'), import('html-to-image')]);
  if (document.fonts?.ready) await document.fonts.ready;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  for (let i = 0; i < pages.length; i++) {
    const node = pages[i];
    const img = await toJpeg(node, {
      quality: 0.92,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      fontEmbedCSS: FONT_CSS,
      width: node.offsetWidth,
      height: node.offsetHeight,
    });
    if (i > 0) doc.addPage('a4', 'portrait');
    doc.addImage(img, 'JPEG', 0, 0, 210, 297);
  }
  doc.setProperties({ title: 'דוח מיפוי מיומנויות בהוראה' });
  return doc.output('blob');
}
