import { NextResponse } from 'next/server';
import { stopRun } from '@/lib/orchestrator/runner';

export const runtime = 'nodejs';

export async function POST(_: Request, { params }: { params: { id: string } }) {
  await stopRun(params.id);
  return NextResponse.json({ status: 'stopping' });
}
