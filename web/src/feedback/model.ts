export type FeedbackStatus = 'open' | 'processed' | 'orphaned';

export interface FeedbackItem {
  id: string;
  selectedText: string;
  contextBefore: string;
  contextAfter: string;
  headingPath: string[];
  feedback: string;
  status: FeedbackStatus;
  createdAt: string;
  shifted?: boolean;
}

export interface AnchorResult {
  matchType: 'exact' | 'fuzzy' | 'none';
  startIndex: number;
  endIndex: number;
}

export function findAnchor(item: FeedbackItem, text: string): AnchorResult {
  const fullPattern = item.contextBefore + item.selectedText + item.contextAfter;
  const exactIdx = text.indexOf(fullPattern);
  if (exactIdx >= 0) {
    return {
      matchType: 'exact',
      startIndex: exactIdx + item.contextBefore.length,
      endIndex: exactIdx + item.contextBefore.length + item.selectedText.length
    };
  }
  const fuzzyIdx = text.indexOf(item.selectedText);
  if (fuzzyIdx >= 0) {
    return { matchType: 'fuzzy', startIndex: fuzzyIdx, endIndex: fuzzyIdx + item.selectedText.length };
  }
  return { matchType: 'none', startIndex: -1, endIndex: -1 };
}

export function resolveStatus(item: FeedbackItem, match: AnchorResult): { status: FeedbackStatus; shifted: boolean } {
  if (match.matchType === 'none') return { status: 'orphaned', shifted: false };
  return {
    status: item.status === 'orphaned' ? 'open' : item.status,
    shifted: match.matchType === 'fuzzy'
  };
}

const FEEDBACK_STATUSES: FeedbackStatus[] = ['open', 'processed', 'orphaned'];

export function normalizeFeedbackItems(value: unknown): FeedbackItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    const normalized = normalizeFeedbackItem(item);
    return normalized ? [normalized] : [];
  });
}

function normalizeFeedbackItem(value: unknown): FeedbackItem | null {
  if (!isRecord(value)) return null;
  const id = readRequiredString(value['id']);
  const selectedText = readRequiredString(value['selectedText']);
  const feedback = readRequiredString(value['feedback']);
  const createdAt = readRequiredString(value['createdAt']);
  const status = readStatus(value['status']);
  if (!id || !selectedText || !feedback || !createdAt || !status) return null;
  return {
    id,
    selectedText,
    contextBefore: readOptionalString(value['contextBefore']),
    contextAfter: readOptionalString(value['contextAfter']),
    headingPath: readHeadingPath(value['headingPath']),
    feedback,
    status,
    createdAt,
    shifted: value['shifted'] === true
  };
}

function readRequiredString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function readOptionalString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function readStatus(value: unknown): FeedbackStatus | null {
  if (value === undefined) return 'open';
  return typeof value === 'string' && FEEDBACK_STATUSES.includes(value as FeedbackStatus)
    ? (value as FeedbackStatus)
    : null;
}

function readHeadingPath(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((part): part is string => typeof part === 'string' && part.trim().length > 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Markdown summary of all open feedback, for the clipboard. */
export function feedbackToMarkdown(filename: string, items: FeedbackItem[]): string {
  const open = items.filter(i => i.status === 'open');
  const lines: string[] = [`# Feedback on \`${filename}\`\n`];
  open.forEach((item, idx) => {
    lines.push(`## Feedback ${idx + 1}`);
    if (item.headingPath.length > 0) lines.push(`**Location:** ${item.headingPath.join(' › ')}`);
    lines.push(`**Selected text:**`);
    lines.push(`> ${item.selectedText.replace(/\n/g, '\n> ')}`);
    lines.push('');
    lines.push(`**Feedback:**`);
    lines.push(item.feedback);
    lines.push('');
    lines.push('---');
    lines.push('');
  });
  return lines.join('\n');
}

export function newId(): string {
  return 'fb_' + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}
