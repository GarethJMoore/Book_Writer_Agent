import { promises as fs } from 'fs';
import path from 'path';
import { RunInput, RunState, RunSummary, Report, Issue, Outline } from '@/types';

const dataRoot = path.join(process.cwd(), 'data');
const runsRoot = path.join(dataRoot, 'runs');

export async function ensureRunDirs(runId: string) {
  await fs.mkdir(path.join(runsRoot, runId, 'chapters'), { recursive: true });
}

export async function writeJSON<T>(filePath: string, data: T) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export async function readJSON<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

export function runPath(runId: string, ...parts: string[]) {
  return path.join(runsRoot, runId, ...parts);
}

export async function saveInputs(runId: string, inputs: RunInput) {
  await writeJSON(runPath(runId, 'inputs.json'), inputs);
}

export async function loadInputs(runId: string) {
  return readJSON<RunInput>(runPath(runId, 'inputs.json'));
}

export async function saveOutline(runId: string, outline: Outline) {
  await writeJSON(runPath(runId, 'outline.json'), outline);
  const markdown = outline.chapters
    .map((chapter, idx) => `${idx + 1}. ${chapter.title}\n   - ${chapter.summary}`)
    .join('\n');
  await fs.writeFile(runPath(runId, 'outline.md'), markdown, 'utf-8');
}

export async function loadOutline(runId: string) {
  return readJSON<Outline>(runPath(runId, 'outline.json'));
}

export async function saveChapter(runId: string, chapterIndex: number, content: string) {
  await fs.writeFile(runPath(runId, 'chapters', `${chapterIndex + 1}.md`), content, 'utf-8');
}

export async function loadChapter(runId: string, chapterIndex: number) {
  try {
    return await fs.readFile(runPath(runId, 'chapters', `${chapterIndex + 1}.md`), 'utf-8');
  } catch {
    return null;
  }
}

export async function saveManuscript(runId: string, content: string) {
  await fs.writeFile(runPath(runId, 'manuscript.md'), content, 'utf-8');
}

export async function loadManuscript(runId: string) {
  try {
    return await fs.readFile(runPath(runId, 'manuscript.md'), 'utf-8');
  } catch {
    return null;
  }
}

export async function saveIssues(runId: string, iteration: number, issues: Issue[]) {
  await writeJSON(runPath(runId, `issues_${iteration}.json`), issues);
}

export async function loadIssues(runId: string, iteration: number) {
  return readJSON<Issue[]>(runPath(runId, `issues_${iteration}.json`));
}

export async function appendLog(runId: string, event: object) {
  const line = JSON.stringify(event);
  await fs.appendFile(runPath(runId, 'logs.ndjson'), `${line}\n`, 'utf-8');
}

export async function saveState(runId: string, state: RunState) {
  await writeJSON(runPath(runId, 'state.json'), state);
}

export async function loadState(runId: string) {
  return readJSON<RunState>(runPath(runId, 'state.json'));
}

export async function listRuns(): Promise<RunSummary[]> {
  try {
    const runIds = await fs.readdir(runsRoot);
    const summaries = await Promise.all(
      runIds.map(async (id) => {
        const inputs = await loadInputs(id);
        const state = await loadState(id);
        const createdAt = (await fs.stat(runPath(id))).mtime.toISOString();
        return {
          runId: id,
          createdAt,
          status: state?.status ?? 'idle',
          idea: inputs?.idea ?? 'Unknown'
        } satisfies RunSummary;
      })
    );
    return summaries;
  } catch {
    return [];
  }
}

export async function saveReport(runId: string, report: Report) {
  await writeJSON(runPath(runId, 'report.json'), report);
}

export async function loadReport(runId: string) {
  return readJSON<Report>(runPath(runId, 'report.json'));
}

export async function loadIssuesHistory(runId: string, iterations: number) {
  const result: Issue[] = [];
  for (let i = 1; i <= iterations; i += 1) {
    const issues = await loadIssues(runId, i);
    if (issues) {
      result.push(...issues);
    }
  }
  return result;
}

export async function saveBookBible(runId: string, bible: RunState['bookBible']) {
  await writeJSON(runPath(runId, 'book_bible.json'), bible);
}

export async function loadBookBible(runId: string) {
  return readJSON<RunState['bookBible']>(runPath(runId, 'book_bible.json'));
}
