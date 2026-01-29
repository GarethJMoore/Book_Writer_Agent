import { createLLMAdapter } from '@/lib/llm';
import { MockAdapter } from '@/lib/llm/mock';
import {
  appendLog,
  ensureRunDirs,
  loadInputs,
  loadIssues,
  loadOutline,
  loadState,
  runPath,
  saveBookBible,
  saveChapter,
  saveIssues,
  saveManuscript,
  saveOutline,
  saveReport,
  saveState
} from '@/lib/storage';
import { collectIssues } from '@/lib/validators';
import { BookBible, Issue, RunInput, RunState } from '@/types';
import { promises as fs } from 'fs';

const defaultBible: BookBible = {
  glossary: [],
  keyClaims: [],
  entities: []
};

function now() {
  return new Date().toISOString();
}

async function logEvent(runId: string, event: object) {
  await appendLog(runId, event);
}

async function loadControl(runId: string) {
  const controlPath = runPath(runId, 'control.json');
  try {
    const content = await fs.readFile(controlPath, 'utf-8');
    return JSON.parse(content) as { stopRequested?: boolean };
  } catch {
    return { stopRequested: false };
  }
}

async function saveControl(runId: string, control: { stopRequested?: boolean }) {
  await fs.writeFile(runPath(runId, 'control.json'), JSON.stringify(control, null, 2));
}

function parseOutline(raw: string, chapterCount?: number | null) {
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const chapters = lines.map((line, idx) => {
    const title = line.replace(/^\d+\.?\s*/, '').trim();
    return { title: title || `Chapter ${idx + 1}`, summary: `Focus on ${title || 'core concepts'}.` };
  });
  if (chapterCount && chapters.length > chapterCount) {
    return { chapters: chapters.slice(0, chapterCount) };
  }
  return { chapters };
}

function updateBibleFromChapter(content: string, bible: BookBible) {
  const matches = content.match(/\b[A-Z][a-zA-Z]{3,}\b/g) ?? [];
  const glossary = new Set([...bible.glossary, ...matches]);
  return { ...bible, glossary: Array.from(glossary).slice(0, 50) };
}

function applyIssueFixes(content: string, issues: Issue[], inputs: RunInput) {
  let updated = content;
  const diffs: string[] = [];
  const banned = inputs.styleGuide
    .split(/[,\n]/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.toLowerCase().startsWith('no '))
    .map((chunk) => chunk.replace(/^no\s+/i, ''));

  banned.forEach((phrase) => {
    if (phrase && updated.toLowerCase().includes(phrase.toLowerCase())) {
      updated = updated.replace(new RegExp(phrase, 'gi'), '');
      diffs.push(`Removed banned phrase: ${phrase}.`);
    }
  });

  if (issues.some((issue) => issue.validator === 'citations')) {
    updated = updated.replace(/(\d[^\n.!?]*)([.!?])/g, '$1 [S1]$2');
    diffs.push('Added citation placeholders to numeric claims.');
  }

  updated = updated
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => {
      const words = sentence.split(/\s+/);
      if (words.length > 28) {
        const midpoint = Math.floor(words.length / 2);
        return `${words.slice(0, midpoint).join(' ')}. ${words.slice(midpoint).join(' ')}`;
      }
      return sentence;
    })
    .join(' ');

  return { updated, diffs };
}

async function reviseWithLLM(prompt: string, runId: string, adapter: ReturnType<typeof createLLMAdapter>) {
  const tokens: string[] = [];
  const content = await adapter.stream({
    prompt,
    onToken: async (token) => {
      tokens.push(token);
      await logEvent(runId, { type: 'token', content: token, at: now() });
    }
  });
  return content.trim();
}

function buildOutlinePrompt(inputs: RunInput) {
  return `OUTLINE\nIdea: ${inputs.idea}\nChapters: ${inputs.chapterCount ?? 'auto'}\nTarget length: ${inputs.targetLength}`;
}

function buildChapterPrompt(inputs: RunInput, chapterTitle: string, chapterNumber: number) {
  return `CHAPTER ${chapterNumber}\nTitle: ${chapterTitle}\nIdea: ${inputs.idea}\nStyle: ${inputs.styleGuide}\nTarget length: ${inputs.targetLength}`;
}

function buildRevisionPrompt(content: string, issues: Issue[]) {
  return `REVISION\nIssues:\n${JSON.stringify(issues, null, 2)}\nManuscript:\n${content}\nDIFF_SUMMARY`;
}

function withinTargetLength(content: string, targetLength: number) {
  const words = content.split(/\s+/).filter(Boolean);
  return Math.abs(words.length - targetLength) / targetLength <= 0.02;
}

function onlyLowSeverity(issues: Issue[]) {
  return issues.length > 0 && issues.every((issue) => issue.severity === 'low');
}

export async function runPipeline(runId: string) {
  await ensureRunDirs(runId);
  const inputs = await loadInputs(runId);
  if (!inputs) {
    throw new Error('Missing inputs.');
  }

  const adapter = createLLMAdapter();
  let state = (await loadState(runId)) ?? {
    runId,
    iteration: 1,
    chapterIndex: 0,
    status: 'running',
    approvedChapters: [],
    bookBible: defaultBible
  } satisfies RunState;

  state.status = 'running';
  await saveState(runId, state);

  while (true) {
    const control = await loadControl(runId);
    if (control.stopRequested) {
      state.status = 'stopped';
      await saveState(runId, state);
      await logEvent(runId, { type: 'error', message: 'Run stopped by user.', at: now() });
      return;
    }

    await logEvent(runId, { type: 'stage_start', stage: 'plan_outline', at: now() });
    let outline = await loadOutline(runId);
    if (!outline) {
      const raw = adapter instanceof MockAdapter
        ? await adapter.generate({ prompt: buildOutlinePrompt(inputs) })
        : await reviseWithLLM(buildOutlinePrompt(inputs), runId, adapter);
      outline = parseOutline(raw, inputs.chapterCount ?? null);
      await saveOutline(runId, outline);
      state.bookBible = { ...state.bookBible, glossary: outline.chapters.map((c) => c.title) };
      await saveBookBible(runId, state.bookBible);
    }
    await logEvent(runId, { type: 'stage_end', stage: 'plan_outline', at: now() });

    const chapterCount = inputs.chapterCount ?? outline.chapters.length;
    if (state.chapterIndex < chapterCount) {
      const chapterNumber = state.chapterIndex + 1;
      await logEvent(runId, { type: 'stage_start', stage: `draft_chapter_${chapterNumber}`, at: now() });
      const chapterTitle = outline.chapters[state.chapterIndex]?.title ?? `Chapter ${chapterNumber}`;
      const draft = adapter instanceof MockAdapter
        ? await adapter.generate({ prompt: buildChapterPrompt(inputs, chapterTitle, chapterNumber) })
        : await reviseWithLLM(buildChapterPrompt(inputs, chapterTitle, chapterNumber), runId, adapter);
      await saveChapter(runId, state.chapterIndex, `# ${chapterTitle}\n\n${draft}`);
      await logEvent(runId, { type: 'stage_end', stage: `draft_chapter_${chapterNumber}`, at: now() });

      await logEvent(runId, { type: 'stage_start', stage: 'validate', at: now() });
      const issues = collectIssues(draft, state.chapterIndex + 1, inputs, state.bookBible);
      await saveIssues(runId, state.iteration, issues);
      await logEvent(runId, { type: 'issue_batch', issues, at: now() });
      await logEvent(runId, { type: 'stage_end', stage: 'validate', at: now() });

      await logEvent(runId, { type: 'stage_start', stage: 'revise', at: now() });
      let revised = draft;
      let diffSummary: string[] = [];
      if (issues.length > 0) {
        if (adapter instanceof MockAdapter) {
          const result = applyIssueFixes(draft, issues, inputs);
          revised = result.updated;
          diffSummary = result.diffs;
        } else {
          revised = await reviseWithLLM(buildRevisionPrompt(draft, issues), runId, adapter);
          diffSummary = ['Revised via LLM for reported issues.'];
        }
      }
      await saveChapter(runId, state.chapterIndex, `# ${chapterTitle}\n\n${revised}`);
      await logEvent(runId, { type: 'stage_end', stage: 'revise', at: now() });

      state.bookBible = updateBibleFromChapter(revised, state.bookBible);
      await saveBookBible(runId, state.bookBible);
      state.lastDiffSummary = diffSummary;
      state.approvedChapters = [...state.approvedChapters, state.chapterIndex];
      state.chapterIndex += 1;
      state.iteration += 1;
      await saveState(runId, state);
      continue;
    }

    await logEvent(runId, { type: 'stage_start', stage: 'assemble', at: now() });
    const chapterContents = await Promise.all(
      Array.from({ length: chapterCount }).map((_, idx) =>
        fs.readFile(runPath(runId, 'chapters', `${idx + 1}.md`), 'utf-8')
      )
    );
    const manuscript = chapterContents.join('\n\n');
    await saveManuscript(runId, manuscript);
    await logEvent(runId, { type: 'stage_end', stage: 'assemble', at: now() });

    await logEvent(runId, { type: 'stage_start', stage: 'validate_manuscript', at: now() });
    const issues = collectIssues(manuscript, null, inputs, state.bookBible);
    await saveIssues(runId, state.iteration, issues);
    await logEvent(runId, { type: 'issue_batch', issues, at: now() });
    await logEvent(runId, { type: 'stage_end', stage: 'validate_manuscript', at: now() });

    if (issues.length === 0 || (onlyLowSeverity(issues) && withinTargetLength(manuscript, inputs.targetLength))) {
      state.status = 'completed';
      await saveState(runId, state);
      break;
    }

    if (state.iteration >= inputs.iterations) {
      state.status = 'completed';
      await saveState(runId, state);
      break;
    }

    await logEvent(runId, { type: 'stage_start', stage: 'revise_manuscript', at: now() });
    let revised = manuscript;
    let diffSummary: string[] = [];
    if (issues.length > 0) {
      if (adapter instanceof MockAdapter) {
        const result = applyIssueFixes(manuscript, issues, inputs);
        revised = result.updated;
        diffSummary = result.diffs;
      } else {
        revised = await reviseWithLLM(buildRevisionPrompt(manuscript, issues), runId, adapter);
        diffSummary = ['Revised full manuscript via LLM for reported issues.'];
      }
    }
    await saveManuscript(runId, revised);
    await logEvent(runId, { type: 'stage_end', stage: 'revise_manuscript', at: now() });

    state.lastDiffSummary = diffSummary;
    state.iteration += 1;
    await saveState(runId, state);
  }

  const history = [] as { iteration: number; issues: number }[];
  for (let i = 1; i <= state.iteration; i += 1) {
    const issues = await loadIssues(runId, i);
    history.push({ iteration: i, issues: issues?.length ?? 0 });
  }

  const report = {
    runId,
    inputs,
    status: state.status,
    iterations: state.iteration,
    finalIssues: (await loadIssues(runId, state.iteration)) ?? [],
    history
  };
  await saveReport(runId, report);
  await saveControl(runId, { stopRequested: false });
}

export async function requestStop(runId: string) {
  await saveControl(runId, { stopRequested: true });
}

export async function clearStop(runId: string) {
  await saveControl(runId, { stopRequested: false });
}
