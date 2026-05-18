"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ScanEvent } from "@/lib/scan/orchestrator";

interface LogLine {
  ts: string;
  text: string;
  color: string;
}

export function FirstScanPanel() {
  const router = useRouter();
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [found, setFound] = useState(0);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(1);
  const logRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);
  const doneRef = useRef(false);

  function addLog(text: string, color = "text-zinc-300") {
    const ts = new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setLogs((prev) => [...prev, { ts, text, color }]);
    setTimeout(() => logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" }), 30);
  }

  useEffect(() => {
    const url = `/api/scan/stream?attempt=${attempt}&t=${Date.now()}`;
    const es = new EventSource(url);
    esRef.current = es;
    es.onopen = () => {
      addLog(`Scan stream connected (attempt ${attempt})`, "text-sky-300");
      setError(false);
    };

    es.onmessage = (e) => {
      const event = JSON.parse(e.data) as ScanEvent;
      switch (event.type) {
        case "stage":
          addLog(event.message, "text-zinc-400");
          break;
        case "progress":
          setProgress({ current: event.current, total: event.total });
          break;
        case "found":
          setFound((n) => n + 1);
          addLog(
            `✓ ${event.service} [${event.status}] · ${event.amount != null ? `${event.currency ?? ""}${event.amount}` : "no amount"} · ${event.cycle ?? "unknown"} · ${event.evidence}`,
            "text-emerald-400",
          );
          break;
        case "summary":
          addLog(
            `Detected: ${event.confirmed} confirmed · ${event.possible} possible · ${event.trial} trial · ${event.canceled} canceled`,
            "text-emerald-300",
          );
          break;
        case "verbose":
          addLog(`[${event.stage}] ${event.message}${event.data ? ` :: ${JSON.stringify(event.data)}` : ""}`, "text-sky-300");
          break;
        case "error":
          addLog(`Error: ${event.message}`, "text-red-400");
          break;
        case "done":
          doneRef.current = true;
          addLog("Done — refreshing dashboard", "text-emerald-300");
          setDone(true);
          es.close();
          setTimeout(() => router.refresh(), 800);
          break;
      }
    };

    es.onerror = () => {
      if (doneRef.current) return;
      addLog(`Stream disconnected (attempt ${attempt}, readyState=${es.readyState}) — click Retry to resume`, "text-red-400");
      setError(true);
      es.close();
    };

    return () => es.close();
  }, [attempt, router]);

  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

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
            { label: "Passed filter", value: String(progress.total) },
            { label: "Found", value: String(found), highlight: true },
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
            <span>{done ? "Complete" : `${pct}%`}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200">
            <div
              className={`h-full rounded-full transition-all duration-300 ${done ? "bg-emerald-500" : "bg-stone-950"}`}
              style={{ width: done ? "100%" : `${pct}%` }}
            />
          </div>
        </div>

        <div
          ref={logRef}
          className="h-80 overflow-y-auto rounded-2xl border border-stone-900 bg-stone-950 p-4 font-mono text-xs leading-6 shadow-sm"
        >
          {logs.length === 0 ? (
            <p className="text-stone-500">Starting scan...</p>
          ) : (
            logs.map((l, i) => (
              <div key={i} className="flex gap-3">
                <span className="shrink-0 text-stone-600">{l.ts}</span>
                <span className={l.color}>{l.text}</span>
              </div>
            ))
          )}
        </div>

        {error && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                esRef.current?.close();
                setError(false);
                setAttempt((n) => n + 1);
              }}
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-stone-50"
            >
              Retry scan
            </button>
            <p className="text-xs text-stone-500">Attempt {attempt}</p>
          </div>
        )}
      </div>
    </div>
  );
}
