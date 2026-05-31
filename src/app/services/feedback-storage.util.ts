import type { FeedbackItem, FeedbackStatus } from './feedback.service';

const FEEDBACK_STATUSES: FeedbackStatus[] = ['open', 'processed', 'orphaned'];

export function normalizeFeedbackItems(value: unknown): FeedbackItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap(item => {
    const normalized = normalizeFeedbackItem(item);
    return normalized ? [normalized] : [];
  });
}

function normalizeFeedbackItem(value: unknown): FeedbackItem | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readRequiredString(value['id']);
  const selectedText = readRequiredString(value['selectedText']);
  const feedback = readRequiredString(value['feedback']);
  const createdAt = readRequiredString(value['createdAt']);
  const status = readStatus(value['status']);

  if (!id || !selectedText || !feedback || !createdAt || !status) {
    return null;
  }

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
  if (value === undefined) {
    return 'open';
  }
  return typeof value === 'string' && FEEDBACK_STATUSES.includes(value as FeedbackStatus)
    ? value as FeedbackStatus
    : null;
}

function readHeadingPath(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((part): part is string => typeof part === 'string' && part.trim().length > 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
