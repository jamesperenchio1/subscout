import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { scanFunction } from "@/lib/scan/inngest-scan";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [scanFunction],
});
