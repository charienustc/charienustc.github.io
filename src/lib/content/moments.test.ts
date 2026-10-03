/**
 * Unit tests for the moments content helpers.
 *
 * These carry the weight for the feed's correctness: the draft filter and the
 * ordering are the only things standing between the directory and the rendered
 * page, so they are tested directly rather than through a build.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  countVisibleMoments,
  groupMomentsByYear,
  momentFileName,
  momentSlugHint,
  selectVisibleMoments,
  shouldShowUpdated,
} from './moments';

const at = (iso: string, extra: Record<string, unknown> = {}) => ({
  id: `src/content/moments/${iso}.md`,
  data: { date: new Date(iso), ...extra },
});

test('formats a filename with a sortable timestamp prefix', () => {
  assert.equal(momentFileName(new Date(2026, 9, 3, 14, 15, 0)), '2026-10-03-141500.md');
});

test('pads single-digit date parts in the filename', () => {
  assert.equal(momentFileName(new Date(2026, 0, 5, 4, 3, 2)), '2026-01-05-040302.md');
});

test('appends a slug hint to the filename when given one', () => {
  assert.equal(momentFileName(new Date(2026, 9, 3, 14, 15, 0), 'hello-world'), '2026-10-03-141500-hello-world.md');
});

test('a plain directory listing of filenames sorts chronologically', () => {
  // The date prefix exists so ordering does not depend on reading frontmatter.
  const names = [
    momentFileName(new Date(2026, 11, 31, 23, 59, 59)),
    momentFileName(new Date(2026, 0, 1, 0, 0, 0)),
    momentFileName(new Date(2026, 5, 15, 12, 0, 0)),
  ];
  assert.deepEqual([...names].sort(), names.toSorted());
});

test('extracts a slug hint from ASCII opening words', () => {
  // Truncation lands on a word boundary: `hello-world-this-is-a-mome` (24 chars)
  // would cut mid-word, so the last complete word that fits wins.
  assert.equal(momentSlugHint('Hello World, this is a moment'), 'hello-world-this-is-a');
});

test('keeps the whole hint when it fits within the budget', () => {
  assert.equal(momentSlugHint('Hello World'), 'hello-world');
});

test('uses the first non-empty line, skipping leading blanks', () => {
  assert.equal(momentSlugHint('\n\n   \nsecond line wins'), 'second-line-wins');
});

test('strips markdown syntax that would pollute a filename', () => {
  assert.equal(momentSlugHint('## Heading [link](https://example.com)'), 'heading-link');
});

test('returns an empty hint for pure Chinese text', () => {
  // Chinese has no word boundaries, so there is nothing meaningful to keep. The
  // caller falls back to a timestamp-only filename rather than a mangled one.
  assert.equal(momentSlugHint('今天天气不错'), '');
});

test('returns an empty hint for an empty or whitespace-only body', () => {
  assert.equal(momentSlugHint(''), '');
  assert.equal(momentSlugHint('   \n  \n'), '');
});

test('never leaves a trailing hyphen after truncation', () => {
  const hint = momentSlugHint('abcdefghij klmnopqrst uvwxyz', 11);
  assert.ok(!hint.endsWith('-'), hint);
});

test('produces a filename-safe hint with no path separators', () => {
  const hint = momentSlugHint('a/b\\c:d*e?f"g<h>i|j');
  assert.ok(!/[/\\:*?"<>|]/.test(hint), hint);
});

test('drops drafts in production but keeps them in development', () => {
  const moments = [at('2026-10-03T10:00:00', { draft: true }), at('2026-10-02T10:00:00')];
  assert.equal(selectVisibleMoments(moments, true).length, 1);
  assert.equal(selectVisibleMoments(moments, false).length, 2);
});

test('treats a missing draft flag as published', () => {
  assert.equal(selectVisibleMoments([at('2026-10-03T10:00:00')], true).length, 1);
});

test('orders moments newest first', () => {
  const moments = [at('2026-01-01T00:00:00'), at('2026-10-03T00:00:00'), at('2026-05-05T00:00:00')];
  const ids = selectVisibleMoments(moments, true).map((m) => m.id);
  assert.deepEqual(ids, [
    'src/content/moments/2026-10-03T00:00:00.md',
    'src/content/moments/2026-05-05T00:00:00.md',
    'src/content/moments/2026-01-01T00:00:00.md',
  ]);
});

test('breaks ties by id so the order is reproducible', () => {
  // Two moments written in the same second must not swap between builds.
  const moments = [
    { id: 'b.md', data: { date: new Date('2026-10-03T10:00:00') } },
    { id: 'a.md', data: { date: new Date('2026-10-03T10:00:00') } },
  ];
  assert.deepEqual(
    selectVisibleMoments(moments, true).map((m) => m.id),
    ['b.md', 'a.md'],
  );
  assert.deepEqual(
    selectVisibleMoments([...moments].reverse(), true).map((m) => m.id),
    ['b.md', 'a.md'],
  );
});

test('does not mutate the input array', () => {
  const moments = [at('2026-01-01T00:00:00'), at('2026-10-03T00:00:00')];
  const original = [...moments];
  selectVisibleMoments(moments, true);
  assert.deepEqual(moments, original);
});

test('groups moments by the year they were written', () => {
  const groups = groupMomentsByYear([at('2025-03-01T00:00:00'), at('2026-10-03T00:00:00'), at('2026-01-01T00:00:00')]);
  assert.deepEqual(
    groups.map((g) => g.year),
    [2026, 2025],
  );
  assert.equal(groups[0].moments.length, 2);
  assert.equal(groups[1].moments.length, 1);
});

test('returns year groups in descending order', () => {
  const groups = groupMomentsByYear([at('2024-01-01T00:00:00'), at('2026-01-01T00:00:00'), at('2025-01-01T00:00:00')]);
  assert.deepEqual(
    groups.map((g) => g.year),
    [2026, 2025, 2024],
  );
});

test('returns no groups for an empty feed', () => {
  assert.deepEqual(groupMomentsByYear([]), []);
});

test('groups by the moment date, not the build date', () => {
  // A moment backdated into last year must land in last year's group.
  const groups = groupMomentsByYear([at('2025-12-31T23:59:59')]);
  assert.equal(groups[0].year, 2025);
});

test('counts only the moments that would be published', () => {
  const moments = [at('2026-10-03T10:00:00', { draft: true }), at('2026-10-02T10:00:00'), at('2026-10-01T10:00:00')];
  assert.equal(countVisibleMoments(moments, true), 2);
  assert.equal(countVisibleMoments(moments, false), 3);
});

test('hides the edited marker for a moment that has never been edited', () => {
  assert.equal(shouldShowUpdated(new Date('2026-10-03T10:00:00'), undefined), false);
});

test('shows the edited marker when the edit came later', () => {
  assert.equal(shouldShowUpdated(new Date('2026-10-03T10:00:00'), new Date('2026-10-05T09:00:00')), true);
});

test('hides the edited marker when the timestamps are identical', () => {
  // A same-second edit would render an "edited" note equal to the date itself,
  // which is pure noise.
  const same = new Date('2026-10-03T10:00:00');
  assert.equal(shouldShowUpdated(same, new Date(same.getTime())), false);
});

test('hides the edited marker when updated predates the date', () => {
  // Should not happen, but a hand-edited file could contain it, and showing
  // "edited before written" would be nonsense.
  assert.equal(shouldShowUpdated(new Date('2026-10-03T10:00:00'), new Date('2026-10-01T10:00:00')), false);
});

test('an edit does not change a moment ordering position', () => {
  // `updated` must never participate in sorting: editing an old moment should
  // not float it to the top of the feed.
  const older = at('2026-01-01T00:00:00', { updated: new Date('2026-10-03T12:00:00') });
  const newer = at('2026-10-03T00:00:00');
  const ids = selectVisibleMoments([older, newer], true).map((m) => m.id);
  assert.equal(ids[0], newer.id, 'the edited old moment must stay below the newer one');
});

test('an edit does not move a moment between year groups', () => {
  const edited = at('2025-06-01T00:00:00', { updated: new Date('2026-10-03T12:00:00') });
  const groups = groupMomentsByYear([edited]);
  assert.equal(groups[0].year, 2025);
});
