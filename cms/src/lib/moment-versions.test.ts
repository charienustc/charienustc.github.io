/**
 * Unit tests for moment version retention paths.
 *
 * The containment cases carry the weight: `momentVersionPath` turns a
 * request-supplied id into a write destination, so a traversal segment
 * slipping through would escalate "can edit a moment" into "can write
 * anywhere on disk".
 */

import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';

import { momentVersionPath, versionTimestamp } from './moment-versions';
import { MOMENT_VERSIONS_DIR } from './paths';

const ROOT = path.join('F:', 'myhomepage');
const AT = new Date(2026, 9, 3, 15, 0, 37, 123);

test('formats a sortable timestamp with millisecond precision', () => {
  assert.equal(versionTimestamp(AT), '20261003-150037123');
});

test('pads single-digit date parts', () => {
  assert.equal(versionTimestamp(new Date(2026, 0, 5, 4, 3, 2, 7)), '20260105-040302007');
});

test('places the version under backups/versions', () => {
  const result = momentVersionPath(ROOT, '2026-10-03-153000.md', AT);
  assert.ok(result);
  assert.ok(result.startsWith(path.join(ROOT, MOMENT_VERSIONS_DIR)));
});

test('keeps the original filename and appends the timestamp', () => {
  const result = momentVersionPath(ROOT, '2026-10-03-153000.md', AT);
  assert.equal(result, path.join(ROOT, MOMENT_VERSIONS_DIR, `2026-10-03-153000.md.${versionTimestamp(AT)}.md`));
});

test('does not share a directory with the deleted-post bin', () => {
  // Editing is routine and deletion is not; mixing them would make the deleted
  // bin meaningless.
  const result = momentVersionPath(ROOT, 'a.md', AT);
  assert.ok(result);
  assert.ok(!result.includes(`${path.sep}deleted${path.sep}`), result);
});

test('accepts a Windows-style separator', () => {
  // The CMS reads ids with backslashes on Windows and passes them back.
  assert.equal(momentVersionPath(ROOT, 'sub\\a.md', AT), momentVersionPath(ROOT, 'sub/a.md', AT));
});

test('two edits in the same millisecond produce different paths', () => {
  const first = momentVersionPath(ROOT, 'a.md', AT);
  const second = momentVersionPath(ROOT, 'a.md', new Date(2026, 9, 3, 15, 0, 37, 124));
  assert.notEqual(first, second);
});

test('rejects a parent-directory traversal', () => {
  assert.equal(momentVersionPath(ROOT, '../../etc/passwd.md', AT), null);
});

test('rejects a traversal that only escapes after normalisation', () => {
  assert.equal(momentVersionPath(ROOT, 'sub/../../../outside.md', AT), null);
});

test('rejects an absolute id', () => {
  const absolute = path.resolve(ROOT, 'src', 'content', 'moments', 'a.md');
  assert.equal(momentVersionPath(ROOT, absolute, AT), null);
});

test('rejects an id pointing at the versions root itself', () => {
  assert.equal(momentVersionPath(ROOT, '..', AT), null);
  assert.equal(momentVersionPath(ROOT, '.', AT), null);
});

test('keeps a nested traversal inside the versions root', () => {
  const result = momentVersionPath(ROOT, 'a/../b.md', AT);
  assert.ok(result);
  assert.equal(path.dirname(result), path.join(ROOT, MOMENT_VERSIONS_DIR));
});

test('every accepted path stays under the versions root', () => {
  const versionsRoot = path.resolve(ROOT, MOMENT_VERSIONS_DIR);
  const ids = ['a.md', 'sub/a.md', 'a/b/c.md', 'sub\\a.md', 'a/../b.md'];
  for (const id of ids) {
    const result = momentVersionPath(ROOT, id, AT);
    assert.ok(result, `expected ${id} to be accepted`);
    const relative = path.relative(versionsRoot, result);
    assert.ok(!relative.startsWith('..') && !path.isAbsolute(relative), `${id} escaped the versions root`);
  }
});
