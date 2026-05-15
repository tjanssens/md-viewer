import { FeedbackItem, FeedbackStatus } from './feedback.service';

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
    return {
      matchType: 'fuzzy',
      startIndex: fuzzyIdx,
      endIndex: fuzzyIdx + item.selectedText.length
    };
  }

  return { matchType: 'none', startIndex: -1, endIndex: -1 };
}

export function resolveStatus(
  item: FeedbackItem,
  match: AnchorResult
): { status: FeedbackStatus; shifted: boolean } {
  if (match.matchType === 'exact') {
    return {
      status: item.status === 'orphaned' ? 'open' : item.status,
      shifted: false
    };
  }
  if (match.matchType === 'fuzzy') {
    return {
      status: item.status === 'orphaned' ? 'open' : item.status,
      shifted: true
    };
  }
  return { status: 'orphaned', shifted: false };
}
