// Raises the patch version (2.0.1 -> 2.0.2) everywhere it is recorded, so a
// merge to main produces a new release. Prints the new version.
import { readFileSync, writeFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const [maj, min, pat] = pkg.version.split('.').map(Number);
const old = pkg.version;
const next = `${maj}.${min}.${pat + 1}`;

const edit = (file, fn) => {
  const before = readFileSync(file, 'utf8');
  const after = fn(before);
  if (after === before) throw new Error(`version ${old} not found in ${file}`);
  writeFileSync(file, after);
};

edit('package.json', s => s.replace(`"version": "${old}"`, `"version": "${next}"`));
edit('package-lock.json', s => {
  const lock = JSON.parse(s);
  lock.version = next;
  lock.packages[''].version = next;
  return `${JSON.stringify(lock, null, 2)}\n`;
});
edit('src-tauri/Cargo.toml', s => s.replace(/^version = "[^"]+"/m, `version = "${next}"`));
edit('src-tauri/Cargo.lock', s => s.replace(`name = "md-viewer"\nversion = "${old}"`, `name = "md-viewer"\nversion = "${next}"`));

console.log(next);
