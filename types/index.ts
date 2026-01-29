export type RunInput = {
  idea: string;
  targetLength: number;
  styleGuide: string;
  iterations: number;
  chapterCount?: number | null;
  sources?: string;
};

export type IssueSeverity = 'low' | 'medium' | 'high';
export type ValidatorName = 'consistency' | 'style' | 'citations';

export type IssueLocation = {
  chapter: number | null;
  start: number | null;
  end: number | null;
};

export type Issue = {
  id: string;
  validator: ValidatorName;
  severity: IssueSeverity;
  location: IssueLocation;
  message: string;
  evidence: string;
  suggested_fix: string;
};

export type Outline = {
  chapters: { title: string; summary: string }[];
};

export type BookBible = {
  glossary: string[];
  keyClaims: string[];
  entities: string[];
};

export type RunState = {
  runId: string;
  iteration: number;
  chapterIndex: number;
  status: 'idle' | 'running' | 'stopped' | 'completed' | 'error';
  approvedChapters: number[];
  bookBible: BookBible;
  lastDiffSummary?: string[];
};

export type LogEvent =
  | { type: 'stage_start'; stage: string; at: string }
  | { type: 'stage_end'; stage: string; at: string }
  | { type: 'token'; content: string; at: string }
  | { type: 'issue_batch'; issues: Issue[]; at: string }
  | { type: 'error'; message: string; at: string };

export type RunSummary = {
  runId: string;
  createdAt: string;
  status: RunState['status'];
  idea: string;
};

export type Report = {
  runId: string;
  inputs: RunInput;
  status: RunState['status'];
  iterations: number;
  finalIssues: Issue[];
  history: { iteration: number; issues: number }[];
};
