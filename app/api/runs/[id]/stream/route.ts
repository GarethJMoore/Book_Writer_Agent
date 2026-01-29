import { runPath } from '@/lib/storage';
import { promises as fs } from 'fs';

export const runtime = 'nodejs';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  const encoder = new TextEncoder();
  let offset = 0;
  let active = true;

  const stream = new ReadableStream({
    async start(controller) {
      async function pushLines() {
        try {
          const filePath = runPath(id, 'logs.ndjson');
          const stats = await fs.stat(filePath).catch(() => null);
          if (!stats) {
            return;
          }
          if (stats.size > offset) {
            const file = await fs.open(filePath, 'r');
            const buffer = Buffer.alloc(stats.size - offset);
            await file.read(buffer, 0, buffer.length, offset);
            await file.close();
            offset = stats.size;
            const text = buffer.toString('utf-8');
            const lines = text.split('\n').filter(Boolean);
            lines.forEach((line) => {
              controller.enqueue(encoder.encode(`data: ${line}\n\n`));
            });
          }
        } catch (error) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: String(error) })}\n\n`));
        }
      }

      while (active) {
        await pushLines();
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
      controller.close();
    },
    cancel() {
      active = false;
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    }
  });
}
