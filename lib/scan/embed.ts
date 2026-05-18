import { pipeline, env, type FeatureExtractionPipeline } from "@xenova/transformers";

// Cache model artifacts in /tmp on Vercel; on local dev use the package's default cache.
env.cacheDir = process.env.VERCEL ? "/tmp/xenova-cache" : env.cacheDir;
env.allowLocalModels = false;

let pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;

function getPipeline(): Promise<FeatureExtractionPipeline> {
  if (!pipelinePromise) {
    pipelinePromise = pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2") as Promise<FeatureExtractionPipeline>;
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
  // Output shape: [batch, 384]. Need to slice the flat Float32Array.
  const dims = 384;
  const result: number[][] = [];
  const data = output.data as Float32Array;
  for (let i = 0; i < texts.length; i++) {
    result.push(Array.from(data.slice(i * dims, (i + 1) * dims)));
  }
  return result;
}

// Postgres vector literal: '[0.1,0.2,...]'
export function toPgVector(vec: number[]): string {
  return `[${vec.join(",")}]`;
}
