import { runPipeline, requestStop } from '@/lib/orchestrator';

const running = new Map<string, Promise<void>>();

export async function startRun(runId: string) {
  if (running.has(runId)) {
    return;
  }
  const promise = runPipeline(runId)
    .catch((error) => {
      console.error(error);
    })
    .finally(() => {
      running.delete(runId);
    });
  running.set(runId, promise);
}

export async function stopRun(runId: string) {
  await requestStop(runId);
}
