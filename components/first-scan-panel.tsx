"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ScanEvent } from "@/lib/scan";

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
  const logRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);

  function addLog(text: string, color = "text-zinc-300") {
    const ts = new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setLogs((prev) => [...prev, { ts, text, color }]);
    setTimeout(() => logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" }), 30);
  }

  useEffect(() => {
    const es = new EventSource("/api/scan/stream");
    esRef.current = es;

    es.onmessage = (e) => {
      const event = JSON.parse(e.data) as ScanEvent;
      switch (event.type) {
        case "start":
          addLog(`Fetched ${event.totalFetched} billing emails from Gmail`, "text-zinc-400");
          break;
        case "filter":
          addLog(`Heuristic filter: ${event.passed} passed, ${event.dropped} dropped`, "text-zinc-400");
          setProgress({ current: 0, total: event.passed });
          break;
        case "processing":
          setProgress({ current: event.current, total: event.total });
          break;
        case "event_collected":
          addLog(`[${event.eventType}] ${event.service} — ${event.subject}`, "text-sky-400");
          break;
        case "analyzing":
          addLog(`Analyzing trends across ${event.services} candidate services…`, "text-yellow-400");
          break;
        case "found":
          setFound((n) => n + 1);
          addLog(
            `✓ ${event.service}${event.amount != null ? ` · ${event.currency ?? ""}${event.amount}` : ""} · ${event.reason === "recurring" ? `${event.occurrences}× charges` : "subscription confirmed"}`,
            "text-emerald-400",
          );
          break;
        case "skipped":
          addLog(`— ${event.subject.slice(0, 60)}`, "text-zinc-600");
          break;
        case "error":
          addLog(`Error: ${event.message}`, "text-red-400");
          break;
        case "done":
          addLog(`Done — ${event.found} subscription${event.found !== 1 ? "s" : ""} found from ${event.scanned} emails`, "text-emerald-300");
          setDone(true);
          es.close();
          setTimeout(() => router.refresh(), 800);
          break;
      }
    };

    es.onerror = () => {
      addLog("Stream disconnected", "text-red-400");
      setError(true);
      es.close();
    };

    return () => es.close();
  }, [router]);

  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Scanning your inbox</h2>
        <p className="mt-1 text-sm text-zinc-500">Reading the last 12 months of billing emails to find your subscriptions.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Processed", value: `${progress.current}${progress.total ? ` / ${progress.total}` : ""}` },
          { label: "Passed filter", value: String(progress.total) },
          { label: "Found", value: String(found), highlight: true },
        ].map(({ label, value, highlight }) => (
          <div key={label} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</p>
            <p className={`mt-1 text-2xl font-semibold ${highlight ? "text-emerald-500" : "text-zinc-900 dark:text-zinc-50"}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div>
        <div className="mb-1.5 flex justify-between text-xs text-zinc-500">
          <span>Progress</span>
          <span>{done ? "Complete" : `${pct}%`}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className={`h-full rounded-full transition-all duration-300 ${done ? "bg-emerald-500" : "bg-zinc-900 dark:bg-white"}`}
            style={{ width: done ? "100%" : `${pct}%` }}
          />
        </div>
      </div>

      {/* Log terminal */}
      <div
        ref={logRef}
        className="h-72 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-950 p-4 font-mono text-xs leading-6 dark:border-zinc-800"
      >
        {logs.length === 0 ? (
          <p className="text-zinc-500">Starting scan…</p>
        ) : (
          logs.map((l, i) => (
            <div key={i} className="flex gap-3">
              <span className="shrink-0 text-zinc-600">{l.ts}</span>
              <span className={l.color}>{l.text}</span>
            </div>
          ))
        )}
      </div>

      {error && (
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg border border-zinc-200 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Retry scan
        </button>
      )}
    </div>
  );
}
