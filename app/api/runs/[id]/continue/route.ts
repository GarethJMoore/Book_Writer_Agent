import { NextResponse } from 'next/server';
import { clearStop } from '@/lib/orchestrator';
import { startRun } from '@/lib/orchestrator/runner';

export const runtime = 'nodejs';

export async function POST(_: Request, { params }: { params: { id: string } }) {
  await clearStop(params.id);
  await startRun(params.id);
  return NextResponse.json({ status: 'running' });
}
