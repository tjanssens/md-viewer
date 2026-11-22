import { joinPath, dirname } from '../src/viewer';

describe('paths', () => {
  it('joins posix paths', () => {
    expect(joinPath('/docs/a', '../b/c.md')).toBe('/docs/b/c.md');
    expect(joinPath('/docs', './x.md')).toBe('/docs/x.md');
    expect(dirname('/docs/a/file.md')).toBe('/docs/a');
  });
  it('joins windows paths', () => {
    expect(joinPath('C:\\docs\\a', '..\\b.md')).toBe('C:\\docs\\b.md');
    expect(joinPath('C:\\docs', 'sub/x.md')).toBe('C:\\docs\\sub\\x.md');
    expect(dirname('C:\\docs\\file.md')).toBe('C:\\docs');
  });
});
