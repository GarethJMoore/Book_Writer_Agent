import { NextResponse } from 'next/server';
import { loadInputs, loadOutline, loadState, runPath } from '@/lib/storage';
import { promises as fs } from 'fs';

export const runtime = 'nodejs';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  const [inputs, outline, state] = await Promise.all([
    loadInputs(id),
    loadOutline(id),
    loadState(id)
  ]);
  let manuscript = '';
  try {
    manuscript = await fs.readFile(runPath(id, 'manuscript.md'), 'utf-8');
  } catch {
    manuscript = '';
  }
  return NextResponse.json({ runId: id, inputs, outline, state, manuscript });
}
