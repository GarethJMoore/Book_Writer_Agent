'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import type { Issue, RunInput, RunSummary } from '@/types';

const defaultInputs: RunInput = {
  idea: 'Designing an agentic workflow for writing a 1500-word book on mindful productivity.',
  targetLength: 1500,
  styleGuide: 'Tone: calm, practical. Reading level: 9th grade. No buzzwords. No fluff.',
  iterations: 3,
  chapterCount: 5,
  sources: 'S1: “Mindful productivity combines focus with sustainable energy management.”\nS2: “Short breaks can improve retention by up to 20%.”'
};

type LogEntry = {
  type: string;
  [key: string]: unknown;
};

export default function HomePage() {
  const [inputs, setInputs] = useState<RunInput>(defaultInputs);
  const [runId, setRunId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [manuscript, setManuscript] = useState('');
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchRuns = useCallback(async () => {
    const response = await fetch('/api/runs');
    const data = await response.json();
    setRuns(data.runs);
  }, []);

  const fetchRunDetails = useCallback(async (id: string) => {
    const response = await fetch(`/api/runs/${id}`);
    const data = await response.json();
    setManuscript(data.manuscript ?? '');
  }, []);

  const startStream = useCallback((id: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    const es = new EventSource(`/api/runs/${id}/stream`);
    es.onmessage = (event) => {
      const parsed = JSON.parse(event.data) as LogEntry;
      setLogs((prev) => [...prev.slice(-150), parsed]);
      if (parsed.type === 'issue_batch') {
        setIssues((parsed.issues as Issue[]) ?? []);
      }
      if (parsed.type === 'stage_end') {
        fetchRunDetails(id);
      }
    };
    es.onerror = () => {
      es.close();
    };
    eventSourceRef.current = es;
  }, [fetchRunDetails]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  const handleRun = async () => {
    setLogs([]);
    setIssues([]);
    const response = await fetch('/api/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inputs)
    });
    const data = await response.json();
    setRunId(data.runId);
    startStream(data.runId);
    fetchRuns();
  };

  const handleStop = async () => {
    if (!runId) return;
    await fetch(`/api/runs/${runId}/stop`, { method: 'POST' });
  };

  const handleContinue = async () => {
    if (!runId) return;
    await fetch(`/api/runs/${runId}/continue`, { method: 'POST' });
    startStream(runId);
  };

  const handleLoadRun = async (id: string) => {
    setRunId(id);
    await fetchRunDetails(id);
    startStream(id);
  };

  const handleExport = (type: 'manuscript' | 'report') => {
    if (!runId) return;
    window.open(`/api/runs/${runId}/export?type=${type}`, '_blank');
  };

  const groupedIssues = useMemo(() => {
    return issues.reduce<Record<string, Issue[]>>((acc, issue) => {
      acc[issue.validator] = acc[issue.validator] || [];
      acc[issue.validator].push(issue);
      return acc;
    }, {});
  }, [issues]);

  const renderedMarkdown = useMemo(() => {
    return marked.parse(manuscript || '') as string;
  }, [manuscript]);

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold">Agentic Book Writer</h1>
          <p className="text-slate-300">
            Pipeline-driven book drafting with structured validators and revision control.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl bg-slate-900/70 p-6 shadow-lg">
            <h2 className="text-xl font-semibold">Run configuration</h2>
            <div className="mt-4 grid gap-4">
              <label className="grid gap-2 text-sm">
                Idea / Topic
                <textarea
                  value={inputs.idea}
                  onChange={(event) => setInputs({ ...inputs, idea: event.target.value })}
                  className="h-24 rounded-lg border border-slate-700 bg-slate-950 p-3"
                />
              </label>
              <label className="grid gap-2 text-sm">
                Target length (words)
                <input
                  type="number"
                  value={inputs.targetLength}
                  onChange={(event) => setInputs({ ...inputs, targetLength: Number(event.target.value) })}
                  className="rounded-lg border border-slate-700 bg-slate-950 p-2"
                />
              </label>
              <label className="grid gap-2 text-sm">
                Style guide
                <textarea
                  value={inputs.styleGuide}
                  onChange={(event) => setInputs({ ...inputs, styleGuide: event.target.value })}
                  className="h-20 rounded-lg border border-slate-700 bg-slate-950 p-3"
                />
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm">
                  Iterations
                  <input
                    type="number"
                    value={inputs.iterations}
                    onChange={(event) => setInputs({ ...inputs, iterations: Number(event.target.value) })}
                    className="rounded-lg border border-slate-700 bg-slate-950 p-2"
                  />
                </label>
                <label className="grid gap-2 text-sm">
                  Chapter count (optional)
                  <input
                    type="number"
                    value={inputs.chapterCount ?? ''}
                    onChange={(event) =>
                      setInputs({
                        ...inputs,
                        chapterCount: event.target.value ? Number(event.target.value) : null
                      })
                    }
                    className="rounded-lg border border-slate-700 bg-slate-950 p-2"
                  />
                </label>
              </div>
              <label className="grid gap-2 text-sm">
                Sources (URLs or pasted snippets)
                <textarea
                  value={inputs.sources ?? ''}
                  onChange={(event) => setInputs({ ...inputs, sources: event.target.value })}
                  className="h-24 rounded-lg border border-slate-700 bg-slate-950 p-3"
                />
              </label>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleRun}
                  className="rounded-lg bg-indigo-500 px-4 py-2 font-semibold text-white"
                >
                  Run
                </button>
                <button
                  onClick={handleStop}
                  className="rounded-lg border border-slate-600 px-4 py-2"
                >
                  Stop
                </button>
                <button
                  onClick={handleContinue}
                  className="rounded-lg border border-slate-600 px-4 py-2"
                >
                  Continue
                </button>
                <button
                  onClick={() => handleExport('manuscript')}
                  className="rounded-lg border border-slate-600 px-4 py-2"
                >
                  Export Manuscript
                </button>
                <button
                  onClick={() => handleExport('report')}
                  className="rounded-lg border border-slate-600 px-4 py-2"
                >
                  Export Report
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900/70 p-6 shadow-lg">
            <h2 className="text-xl font-semibold">Prior runs</h2>
            <div className="mt-4 space-y-3">
              {runs.length === 0 && (
                <p className="text-sm text-slate-400">No runs yet.</p>
              )}
              {runs.map((run) => (
                <button
                  key={run.runId}
                  onClick={() => handleLoadRun(run.runId)}
                  className="flex w-full items-start justify-between rounded-lg border border-slate-700 p-3 text-left"
                >
                  <div>
                    <p className="font-semibold">{run.idea}</p>
                    <p className="text-xs text-slate-400">{run.runId}</p>
                  </div>
                  <span className="text-xs text-slate-300">{run.status}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_0.7fr]">
          <div className="rounded-2xl bg-slate-900/70 p-6 shadow-lg">
            <h2 className="text-xl font-semibold">Manuscript</h2>
            <div
              className="markdown mt-4 max-h-[480px] overflow-y-auto rounded-lg bg-slate-950 p-4 text-sm leading-6"
              dangerouslySetInnerHTML={{ __html: renderedMarkdown }}
            />
          </div>
          <div className="flex flex-col gap-6">
            <div className="rounded-2xl bg-slate-900/70 p-6 shadow-lg">
              <h2 className="text-xl font-semibold">Issues</h2>
              <div className="mt-4 space-y-4 text-sm">
                {Object.keys(groupedIssues).length === 0 && (
                  <p className="text-slate-400">No issues reported yet.</p>
                )}
                {Object.entries(groupedIssues).map(([validator, items]) => (
                  <div key={validator}>
                    <p className="font-semibold capitalize">{validator}</p>
                    <ul className="mt-2 space-y-2">
                      {items.map((issue) => (
                        <li key={issue.id} className="rounded-lg border border-slate-800 p-3">
                          <p className="text-xs text-slate-400">{issue.severity.toUpperCase()}</p>
                          <p className="font-medium">{issue.message}</p>
                          <p className="text-xs text-slate-400">{issue.suggested_fix}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl bg-slate-900/70 p-6 shadow-lg">
              <h2 className="text-xl font-semibold">Live log</h2>
              <div className="mt-4 max-h-60 space-y-2 overflow-y-auto text-xs text-slate-300">
                {logs.map((log, idx) => (
                  <div key={`${log.type}-${idx}`} className="rounded bg-slate-950 p-2">
                    <p className="font-semibold">{log.type}</p>
                    <pre className="whitespace-pre-wrap">{JSON.stringify(log, null, 2)}</pre>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
