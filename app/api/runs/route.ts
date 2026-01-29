import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { ensureRunDirs, listRuns, saveInputs, saveState } from '@/lib/storage';
import { startRun } from '@/lib/orchestrator/runner';
import { RunInput, RunState } from '@/types';

export const runtime = 'nodejs';

export async function GET() {
  const runs = await listRuns();
  return NextResponse.json({ runs });
}

export async function POST(request: Request) {
  const body = (await request.json()) as RunInput;
  const runId = uuidv4();
  await ensureRunDirs(runId);
  await saveInputs(runId, body);
  const state: RunState = {
    runId,
    iteration: 1,
    chapterIndex: 0,
    status: 'running',
    approvedChapters: [],
    bookBible: { glossary: [], keyClaims: [], entities: [] }
  };
  await saveState(runId, state);
  await startRun(runId);
  return NextResponse.json({ runId });
}
