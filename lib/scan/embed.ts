// Postgres vector literal: '[0.1,0.2,...]'
export function toPgVector(vec: number[]): string {
  return `[${vec.join(",")}]`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pipelinePromise: Promise<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getPipeline(): Promise<any> {
  if (!pipelinePromise) {
    // Dynamic import defers loading to call-time so the module doesn't crash on init.
    // @xenova/transformers loads ONNX/WASM natives that fail if imported at module level on Vercel.
    pipelinePromise = import("@xenova/transformers").then(({ pipeline, env }) => {
      env.cacheDir = process.env.VERCEL ? "/tmp/xenova-cache" : env.cacheDir;
      env.allowLocalModels = false;
      return pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    });
  }
  return pipelinePromise;
}

export async function embed(text: string): Promise<number[]> {
  const extractor = await getPipeline();
  const cleaned = text.replace(/\s+/g, " ").trim().slice(0, 2000);
  const output = await extractor(cleaned, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const extractor = await getPipeline();
  const cleaned = texts.map((t) => t.replace(/\s+/g, " ").trim().slice(0, 2000));
  const output = await extractor(cleaned, { pooling: "mean", normalize: true });
  const dims = 384;
  const result: number[][] = [];
  const data = output.data as Float32Array;
  for (let i = 0; i < texts.length; i++) {
    result.push(Array.from(data.slice(i * dims, (i + 1) * dims)));
  }
  return result;
}
