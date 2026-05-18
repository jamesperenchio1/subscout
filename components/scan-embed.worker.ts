import { pipeline, env, type FeatureExtractionPipeline } from "@xenova/transformers";

env.allowLocalModels = false;

type InitMessage = { type: "init" };
type EmbedMessage = { type: "embed"; items: Array<{ event_id: string; text: string }> };
type InboundMessage = InitMessage | EmbedMessage;

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;
let backend: "webgpu" | "wasm" | null = null;

async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const webgpuExtractor = (await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
          device: "webgpu",
          quantized: true,
        } as any)) as FeatureExtractionPipeline;
        backend = "webgpu";
        return webgpuExtractor;
      } catch {
        const wasmExtractor = (await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
          quantized: true,
        })) as FeatureExtractionPipeline;
        backend = "wasm";
        return wasmExtractor;
      }
    })();
  }
  return extractorPromise;
}

self.onmessage = async (event: MessageEvent<InboundMessage>) => {
  const data = event.data;
  if (data.type === "init") {
    try {
      await getExtractor();
      self.postMessage({ type: "ready", backend, dtype: "q8" });
    } catch (err) {
      self.postMessage({ type: "error", message: `Embedding init failed: ${String(err)}` });
    }
    return;
  }

  if (data.type === "embed") {
    try {
      const extractor = await getExtractor();
      const texts = data.items.map((item) => item.text);
      const output = await extractor(texts, { pooling: "mean", normalize: true });
      const packed = output.data as Float32Array;
      const dims = 384;
      const vectors = data.items.map((item, index) => ({
        event_id: item.event_id,
        embedding: Array.from(packed.slice(index * dims, (index + 1) * dims)),
      }));
      self.postMessage({
        type: "embedded",
        backend,
        dtype: "q8",
        vectors,
      });
    } catch (err) {
      self.postMessage({ type: "error", message: `Embedding batch failed: ${String(err)}` });
    }
  }
};
