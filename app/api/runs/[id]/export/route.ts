import { NextResponse } from 'next/server';
import { runPath } from '@/lib/storage';
import { promises as fs } from 'fs';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  const url = new URL(request.url);
  const type = url.searchParams.get('type');

  if (type === 'manuscript') {
    const content = await fs.readFile(runPath(id, 'manuscript.md'), 'utf-8');
    return new Response(content, {
      headers: {
        'Content-Type': 'text/markdown',
        'Content-Disposition': `attachment; filename=manuscript-${id}.md`
      }
    });
  }

  const content = await fs.readFile(runPath(id, 'report.json'), 'utf-8');
  return new Response(content, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename=report-${id}.json`
    }
  });
}
