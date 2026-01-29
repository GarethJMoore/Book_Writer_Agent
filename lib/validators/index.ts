import { Issue, RunInput, BookBible } from '@/types';
import { v4 as uuidv4 } from 'uuid';

const sentenceSplit = /(?<=[.!?])\s+/;

export function validateConsistency(content: string, chapterIndex: number | null, bible: BookBible): Issue[] {
  const issues: Issue[] = [];
  bible.glossary.forEach((term) => {
    if (!content.includes(term) && term.length > 3) {
      issues.push({
        id: uuidv4(),
        validator: 'consistency',
        severity: 'low',
        location: { chapter: chapterIndex, start: null, end: null },
        message: `Key term "${term}" is missing from this chapter.`,
        evidence: term,
        suggested_fix: `Consider referencing ${term} to stay consistent with the book bible.`
      });
    }
  });

  if (content.includes('contradiction') || content.includes('conflicting')) {
    issues.push({
      id: uuidv4(),
      validator: 'consistency',
      severity: 'medium',
      location: { chapter: chapterIndex, start: null, end: null },
      message: 'Potential contradiction detected.',
      evidence: 'contradiction/conflicting keywords',
      suggested_fix: 'Clarify the statement to remove conflicting claims.'
    });
  }

  return issues;
}

export function validateStyle(content: string, chapterIndex: number | null, inputs: RunInput): Issue[] {
  const issues: Issue[] = [];
  const banned = inputs.styleGuide
    .split(/[,\n]/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.toLowerCase().startsWith('no '))
    .map((chunk) => chunk.replace(/^no\s+/i, ''));

  banned.forEach((phrase) => {
    if (phrase && content.toLowerCase().includes(phrase.toLowerCase())) {
      issues.push({
        id: uuidv4(),
        validator: 'style',
        severity: 'high',
        location: { chapter: chapterIndex, start: null, end: null },
        message: `Banned phrase detected: ${phrase}.`,
        evidence: phrase,
        suggested_fix: `Remove or replace the phrase "${phrase}".`
      });
    }
  });

  const sentences = content.split(sentenceSplit).filter(Boolean);
  sentences.forEach((sentence) => {
    const wordCount = sentence.trim().split(/\s+/).length;
    if (wordCount > 28) {
      issues.push({
        id: uuidv4(),
        validator: 'style',
        severity: 'medium',
        location: { chapter: chapterIndex, start: null, end: null },
        message: 'Overlong sentence detected.',
        evidence: sentence.slice(0, 120),
        suggested_fix: 'Split the sentence into shorter sentences.'
      });
    }
  });

  return issues;
}

export function validateCitations(content: string, chapterIndex: number | null, inputs: RunInput): Issue[] {
  if (!inputs.sources || inputs.sources.trim().length === 0) {
    return [];
  }
  const issues: Issue[] = [];
  const sentences = content.split(sentenceSplit).filter(Boolean);
  sentences.forEach((sentence) => {
    if (/\d/.test(sentence) && !/\[S\d+\]/.test(sentence)) {
      issues.push({
        id: uuidv4(),
        validator: 'citations',
        severity: 'high',
        location: { chapter: chapterIndex, start: null, end: null },
        message: 'Unverified factual claim.',
        evidence: sentence.slice(0, 120),
        suggested_fix: 'Add a citation tag like [S1] or remove the claim.'
      });
    }
  });
  return issues;
}

export function collectIssues(content: string, chapterIndex: number | null, inputs: RunInput, bible: BookBible) {
  return [
    ...validateConsistency(content, chapterIndex, bible),
    ...validateStyle(content, chapterIndex, inputs),
    ...validateCitations(content, chapterIndex, inputs)
  ];
}
