import { describe, expect, it } from 'vitest';
import { MARKER, REPO, issueBody, issueTitle, issueUrl, platformName } from '../src/report';

describe('feedback report', () => {
  it('builds a title from the title field or the first line', () => {
    expect(issueTitle({ kind: 'bug', title: ' Crash on save ', text: 'x' })).toBe('[Bug] Crash on save');
    expect(issueTitle({ kind: 'idea', title: '', text: 'Dark tables\nmore text' })).toBe('[Idea] Dark tables');
    expect(issueTitle({ kind: 'idea', title: 'a'.repeat(100), text: 'x' })).toHaveLength('[Idea] '.length + 78);
  });

  it('puts details and the marker in the body', () => {
    const body = issueBody({ kind: 'bug', title: '', text: ' Broken ', version: '2.0.1', platform: 'Windows' });
    expect(body.startsWith('Broken\n')).toBe(true);
    expect(body).toContain('App version: 2.0.1');
    expect(body).toContain('Platform: Windows');
    expect(body.endsWith(MARKER)).toBe(true);
  });

  it('links to the new-issue page of the repo with encoded fields', () => {
    const url = new URL(issueUrl({ kind: 'idea', title: 'A & B', text: 'line 1\nline 2 #x' }));
    expect(`${url.origin}${url.pathname}`).toBe(`https://github.com/${REPO}/issues/new`);
    expect(url.searchParams.get('title')).toBe('[Idea] A & B');
    expect(url.searchParams.get('body')).toContain('line 1\nline 2 #x');
    expect(url.searchParams.get('body')).toContain(MARKER);
  });

  it('truncates very long feedback but keeps the marker', () => {
    const url = issueUrl({ kind: 'bug', title: 't', text: 'é'.repeat(20000) });
    expect(url.length).toBeLessThanOrEqual(7000);
    expect(new URL(url).searchParams.get('body')).toContain(MARKER);
  });

  it('detects the platform', () => {
    expect(platformName('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('Windows');
    expect(platformName('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)')).toBe('macOS');
  });
});
