/**
 * Unit tests for deleted-post retention paths.
 *
 * The containment cases carry the weight here: `retentionPath` turns a value
 * derived from an HTTP request into a write destination, so a traversal segment
 * slipping through would escalate "can delete a post" into "can write anywhere".
 */

import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';

import { deletionTimestamp, retentionPath } from './deleted-posts';
import { DELETED_POST_SUFFIX, DELETED_POSTS_DIR } from './paths';

const ROOT = path.join('F:', 'myhomepage');
const AT = new Date(2026, 9, 3, 15, 0, 37, 123);

test('formats a sortable timestamp with millisecond precision', () => {
  assert.equal(deletionTimestamp(AT), '20261003-150037123');
});

test('pads single-digit date parts', () => {
  assert.equal(deletionTimestamp(new Date(2026, 0, 5, 4, 3, 2, 7)), '20260105-040302007');
});

test('keeps the post directory structure and appends the suffix', () => {
  const result = retentionPath(ROOT, 'life/poem.md', AT);
  assert.equal(result, path.join(ROOT, DELETED_POSTS_DIR, `life/poem.md.${deletionTimestamp(AT)}${DELETED_POST_SUFFIX}`));
});

test('handles a post at the content root', () => {
  const result = retentionPath(ROOT, 'poem.md', AT);
  assert.ok(result);
  assert.ok(result.startsWith(path.join(ROOT, DELETED_POSTS_DIR)));
  assert.ok(result.includes(`poem.md.${deletionTimestamp(AT)}`));
});

test('accepts a Windows-style separator in the post id', () => {
  // The CMS reads post ids with backslashes on Windows and passes them straight
  // back, so this is the ordinary case rather than an edge case.
  assert.equal(retentionPath(ROOT, 'life\\poem.md', AT), retentionPath(ROOT, 'life/poem.md', AT));
});

test('two deletions at different milliseconds produce different paths', () => {
  const first = retentionPath(ROOT, 'poem.md', AT);
  const second = retentionPath(ROOT, 'poem.md', new Date(2026, 9, 3, 15, 0, 37, 124));
  assert.notEqual(first, second);
});

test('rejects a parent-directory traversal', () => {
  assert.equal(retentionPath(ROOT, '../../etc/passwd.md', AT), null);
});

test('rejects a traversal that only escapes after normalisation', () => {
  // Innocent-looking prefix, but the nested segments climb back out.
  assert.equal(retentionPath(ROOT, 'sub/../../../outside.md', AT), null);
});

test('rejects an absolute post id', () => {
  const absolute = path.resolve(ROOT, 'src', 'content', 'blog', 'poem.md');
  assert.equal(retentionPath(ROOT, absolute, AT), null);
});

test('rejects a post id pointing at the retention root itself', () => {
  assert.equal(retentionPath(ROOT, '..', AT), null);
  assert.equal(retentionPath(ROOT, '.', AT), null);
});

test('keeps a nested traversal inside the retention root', () => {
  // `a/../b.md` resolves within the root, so it is allowed — but it must land
  // directly under the root, not one level up.
  const result = retentionPath(ROOT, 'a/../b.md', AT);
  assert.ok(result);
  assert.equal(path.dirname(result), path.join(ROOT, DELETED_POSTS_DIR));
});

test('every accepted path stays under the retention root', () => {
  const retentionRoot = path.resolve(ROOT, DELETED_POSTS_DIR);
  const ids = ['poem.md', 'life/poem.md', 'a/b/c/poem.md', 'life\\poem.md', 'a/../b.md'];
  for (const id of ids) {
    const result = retentionPath(ROOT, id, AT);
    assert.ok(result, `expected ${id} to be accepted`);
    const relative = path.relative(retentionRoot, result);
    assert.ok(!relative.startsWith('..') && !path.isAbsolute(relative), `${id} escaped the retention root`);
  }
});
