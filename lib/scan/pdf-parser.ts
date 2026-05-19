// Side-effect import: sets globalThis.pdfjsWorker so pdfjs can use its fake worker
// in a Node.js serverside environment (no browser Worker API available)
import "pdfjs-dist/build/pdf.worker.mjs";
import { getDocument } from "pdfjs-dist";

const MAX_TEXT_CHARS = 12000;
const MAX_PAGES = 20;

export interface PdfParseResult {
  text: string;
  pageCount: number;
  isImageOnly: boolean;
}

export async function parsePdfBuffer(buffer: Buffer): Promise<PdfParseResult> {
  const uint8 = new Uint8Array(buffer);
  const loadingTask = getDocument({
    data: uint8,
    disableFontFace: true,
    verbosity: 0,
    useSystemFonts: false,
  });

  const doc = await loadingTask.promise;
  const pageCount = doc.numPages;
  const pageLimit = Math.min(pageCount, MAX_PAGES);
  const parts: string[] = [];

  for (let i = 1; i <= pageLimit; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? (item as { str: string }).str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (pageText) parts.push(pageText);
    page.cleanup();
  }

  await doc.destroy();

  const text = parts.join("\n").slice(0, MAX_TEXT_CHARS);
  return { text, pageCount, isImageOnly: text.trim().length === 0 };
}
