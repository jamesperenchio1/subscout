"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface JobStatus {
  id: string;
  status: "pending" | "running" | "done" | "error";
  latest_stage: string | null;
  progress: { current: number; total: number; filtered: number } | null;
  summary: { confirmed: number; possible: number; canceled: number; trial: number } | null;
  error_message: string | null;
}

interface LogLine {
  ts: string;
  text: string;
  color: string;
}

function now() {
  return new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function FirstScanPanel() {
  const router = useRouter();
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<JobStatus | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const lastStageRef = useRef<string>("");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneRef = useRef(false);

  const addLog = useCallback((text: string, color = "text-zinc-300") => {
    const ts = now();
    setLogs((prev) => [...prev, { ts, text, color }]);
    setTimeout(() => logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" }), 30);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const startScan = useCallback(async () => {
    stopPolling();
    doneRef.current = false;
    setStarting(true);
    setStartError(null);
    setLogs([]);
    setJob(null);
    setJobId(null);
    lastStageRef.current = "";

    try {
      const res = await fetch("/api/scan/start", { method: "POST" });
      const data = await res.json() as { jobId?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to start scan");
      addLog("Scan queued…", "text-sky-300");
      setJobId(data.jobId!);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStartError(msg);
      addLog(`Failed to start: ${msg}`, "text-red-400");
      setStarting(false);
    }
  }, [addLog, stopPolling]);

  // Start scan on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    startScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll when we have a jobId
  useEffect(() => {
    if (!jobId) return;

    const poll = async () => {
      if (doneRef.current) return;
      try {
        const res = await fetch(`/api/scan/status?jobId=${jobId}`);
        if (!res.ok) return;
        const data = await res.json() as JobStatus;
        setJob(data);

        if (data.latest_stage && data.latest_stage !== lastStageRef.current) {
          lastStageRef.current = data.latest_stage;
          addLog(data.latest_stage, "text-zinc-400");
        }

        if (data.status === "done" && !doneRef.current) {
          doneRef.current = true;
          const s = data.summary;
          if (s) {
            addLog(
              `Detected: ${s.confirmed} confirmed · ${s.possible} possible · ${s.trial} trial · ${s.canceled} canceled`,
              "text-emerald-300",
            );
          }
          addLog("Done — refreshing dashboard", "text-emerald-300");
          stopPolling();
          setStarting(false);
          setTimeout(() => router.refresh(), 800);
        } else if (data.status === "error") {
          addLog(`Error: ${data.error_message ?? "Unknown error"}`, "text-red-400");
          stopPolling();
          setStarting(false);
        }
      } catch {
        // transient network error — keep polling
      }
    };

    pollingRef.current = setInterval(poll, 2000);
    poll();

    return () => stopPolling();
  }, [jobId, addLog, stopPolling, router]);

  const progress = job?.progress ?? { current: 0, total: 0, filtered: 0 };
  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
  const done = job?.status === "done";
  const hasError = job?.status === "error" || !!startError;
  const found = job?.summary?.confirmed ?? 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <div className="space-y-4">
        <div className="rounded-2xl border border-stone-200 bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">First scan</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-stone-950">Reading your billing trail</h2>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            We scan Gmail metadata and billing email text, extract subscription events, then store only structured results and source references.
          </p>
        </div>
        <div className="rounded-2xl bg-stone-950 p-5 text-white">
          <p className="text-sm font-semibold text-lime-200">What we scan</p>
          <ul className="mt-4 space-y-3">
            {[
              "Billing receipts and renewal emails",
              "Charges in any language or currency",
              "2 years of inbox history",
              "Recurring patterns only — no one-offs",
            ].map((note) => (
              <li key={note} className="text-sm text-stone-300">{note}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Processed", value: `${progress.current}${progress.total ? ` / ${progress.total}` : ""}` },
            { label: "Passed filter", value: String(progress.filtered) },
            { label: "Found", value: done ? String(found) : "—", highlight: done && found > 0 },
          ].map(({ label, value, highlight }) => (
            <div key={label} className="rounded-2xl border border-stone-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">{label}</p>
              <p className={`mt-2 text-2xl font-semibold ${highlight ? "text-emerald-600" : "text-stone-950"}`}>{value}</p>
            </div>
          ))}
        </div>

        <div>
          <div className="mb-1.5 flex justify-between text-xs text-stone-500">
            <span>Progress</span>
            <span>{done ? "Complete" : starting ? `${pct}%` : "—"}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200">
            <div
              className={`h-full rounded-full transition-all duration-300 ${done ? "bg-emerald-500" : hasError ? "bg-red-500" : "bg-stone-950"}`}
              style={{ width: done ? "100%" : `${pct}%` }}
            />
          </div>
        </div>

        <div
          ref={logRef}
          className="h-80 overflow-y-auto rounded-2xl border border-stone-900 bg-stone-950 p-4 font-mono text-xs leading-6 shadow-sm"
        >
          {logs.length === 0 ? (
            <p className="text-stone-500">Starting scan…</p>
          ) : (
            logs.map((l, i) => (
              <div key={i} className="flex gap-3">
                <span className="shrink-0 text-stone-600">{l.ts}</span>
                <span className={l.color}>{l.text}</span>
              </div>
            ))
          )}
        </div>

        {hasError && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => startScan()}
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-stone-50"
            >
              Retry scan
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
