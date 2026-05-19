// pdfjs-dist v5's standard build references DOMMatrix at module scope.
// We polyfill it on globalThis BEFORE the dynamic import so the module can load.
// Dynamic imports (not static) are required so the polyfill runs first.

const MAX_TEXT_CHARS = 12000;
const MAX_PAGES = 20;

export interface PdfParseResult {
  text: string;
  pageCount: number;
  isImageOnly: boolean;
}

function installDomPolyfills() {
  if (typeof globalThis.DOMMatrix !== "undefined") return;

  // Minimal 2D affine-transform implementation sufficient for pdfjs text extraction.
  class NodeDOMMatrix {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    m11 = 1; m12 = 0; m13 = 0; m14 = 0;
    m21 = 0; m22 = 1; m23 = 0; m24 = 0;
    m31 = 0; m32 = 0; m33 = 1; m34 = 0;
    m41 = 0; m42 = 0; m43 = 0; m44 = 1;
    is2D = true; isIdentity = true;

    constructor(init?: string | number[]) {
      if (!Array.isArray(init)) return;
      if (init.length === 6) {
        [this.a, this.b, this.c, this.d, this.e, this.f] = init;
        this.m11 = init[0]; this.m12 = init[1];
        this.m21 = init[2]; this.m22 = init[3];
        this.m41 = init[4]; this.m42 = init[5];
        this.isIdentity = false;
      }
    }

    scaleSelf(sx: number, sy = sx) {
      this.a *= sx; this.b *= sx; this.c *= sy; this.d *= sy;
      this.m11 = this.a; this.m12 = this.b; this.m21 = this.c; this.m22 = this.d;
      this.isIdentity = false;
      return this;
    }

    translateSelf(tx: number, ty: number) {
      this.e += this.a * tx + this.c * ty;
      this.f += this.b * tx + this.d * ty;
      this.m41 = this.e; this.m42 = this.f;
      this.isIdentity = false;
      return this;
    }

    invertSelf() {
      const det = this.a * this.d - this.b * this.c;
      if (Math.abs(det) < 1e-10) return this;
      const inv = 1 / det;
      const a = this.d * inv, b = -this.b * inv, c = -this.c * inv, d = this.a * inv;
      const e = -(a * this.e + c * this.f), f = -(b * this.e + d * this.f);
      this.a = a; this.b = b; this.c = c; this.d = d; this.e = e; this.f = f;
      this.m11 = a; this.m12 = b; this.m21 = c; this.m22 = d; this.m41 = e; this.m42 = f;
      return this;
    }

    multiplySelf(o: NodeDOMMatrix) {
      const a = this.a * o.a + this.c * o.b, b = this.b * o.a + this.d * o.b;
      const c = this.a * o.c + this.c * o.d, d = this.b * o.c + this.d * o.d;
      const e = this.a * o.e + this.c * o.f + this.e, f = this.b * o.e + this.d * o.f + this.f;
      this.a = a; this.b = b; this.c = c; this.d = d; this.e = e; this.f = f;
      this.m11 = a; this.m12 = b; this.m21 = c; this.m22 = d; this.m41 = e; this.m42 = f;
      return this;
    }

    preMultiplySelf(o: NodeDOMMatrix) {
      const a = o.a * this.a + o.c * this.b, b = o.b * this.a + o.d * this.b;
      const c = o.a * this.c + o.c * this.d, d = o.b * this.c + o.d * this.d;
      const e = o.a * this.e + o.c * this.f + o.e, f = o.b * this.e + o.d * this.f + o.f;
      this.a = a; this.b = b; this.c = c; this.d = d; this.e = e; this.f = f;
      this.m11 = a; this.m12 = b; this.m21 = c; this.m22 = d; this.m41 = e; this.m42 = f;
      return this;
    }

    multiply(o: NodeDOMMatrix) {
      return new NodeDOMMatrix([this.a, this.b, this.c, this.d, this.e, this.f]).multiplySelf(o);
    }

    inverse() {
      return new NodeDOMMatrix([this.a, this.b, this.c, this.d, this.e, this.f]).invertSelf();
    }

    translate(tx: number, ty: number) {
      return new NodeDOMMatrix([this.a, this.b, this.c, this.d, this.e, this.f]).translateSelf(tx, ty);
    }

    scale(sx: number, sy = sx) {
      return new NodeDOMMatrix([this.a, this.b, this.c, this.d, this.e, this.f]).scaleSelf(sx, sy);
    }

    transformPoint(p: { x: number; y: number }) {
      return { x: this.a * p.x + this.c * p.y + this.e, y: this.b * p.x + this.d * p.y + this.f, z: 0, w: 1 };
    }

    static fromMatrix(m: Partial<NodeDOMMatrix>) {
      const out = new NodeDOMMatrix();
      return Object.assign(out, m);
    }
  }

  (globalThis as Record<string, unknown>).DOMMatrix = NodeDOMMatrix;

  if (typeof globalThis.Path2D === "undefined") {
    (globalThis as Record<string, unknown>).Path2D = class Path2D {
      addPath() {}
      moveTo() {} lineTo() {} bezierCurveTo() {} quadraticCurveTo() {}
      closePath() {} arc() {} rect() {}
    };
  }
}

let pdfJsLoaded = false;

async function loadPdfJs() {
  if (pdfJsLoaded) return;
  installDomPolyfills();
  // Worker import sets globalThis.pdfjsWorker for the fake-worker fallback
  await import("pdfjs-dist/build/pdf.worker.mjs");
  pdfJsLoaded = true;
}

export async function parsePdfBuffer(buffer: Buffer): Promise<PdfParseResult> {
  await loadPdfJs();
  // Dynamic import so pdfjs is not bundled at build time (see serverExternalPackages in next.config.ts)
  const { getDocument } = await import("pdfjs-dist");

  const uint8 = new Uint8Array(buffer);
  const loadingTask = getDocument({ data: uint8, disableFontFace: true, verbosity: 0, useSystemFonts: false });
  const doc = await loadingTask.promise;
  const pageCount = doc.numPages;
  const parts: string[] = [];

  for (let i = 1; i <= Math.min(pageCount, MAX_PAGES); i++) {
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
