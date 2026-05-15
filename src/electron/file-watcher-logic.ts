export interface ChangeDetectionInput {
  now: number;
  ignoreUntil: number;
  currentMtime: number;
  lastKnownMtime: number;
}

export function shouldReportChange(input: ChangeDetectionInput): boolean {
  if (input.now < input.ignoreUntil) return false;
  if (input.currentMtime === input.lastKnownMtime) return false;
  return true;
}
