/**
 * Unit tests for moment serialization.
 *
 * The YAML quoting rules carry the weight: moment tags are free-form user input
 * written straight into frontmatter, so an unescaped quote or colon would corrupt
 * the file rather than fail loudly.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  extractMomentBody,
  formatMomentDate,
  parseMomentFrontmatter,
  quoteYamlScalar,
  serializeMoment,
} from './moment-serialize';

const date = new Date(2026, 9, 3, 15, 30, 0);

test('formats a date in local time without a timezone suffix', () => {
  // A `Z`-suffixed ISO string would be reinterpreted as site-local on read,
  // shifting the moment by the UTC offset.
  assert.equal(formatMomentDate(date), '2026-10-03 15:30:00');
});

test('pads single-digit date and time parts', () => {
  assert.equal(formatMomentDate(new Date(2026, 0, 5, 4, 3, 2)), '2026-01-05 04:03:02');
});

test('quotes a plain scalar', () => {
  assert.equal(quoteYamlScalar('hello'), "'hello'");
});

test('escapes an embedded single quote by doubling it', () => {
  assert.equal(quoteYamlScalar("it's"), "'it''s'");
});

test('neutralises YAML-significant characters', () => {
  // Unquoted, each of these would change the parsed type or break the document.
  for (const value of ['a: b', '#comment', '[list]', '{map}', '- item', '*alias']) {
    const quoted = quoteYamlScalar(value);
    assert.ok(quoted.startsWith("'") && quoted.endsWith("'"), value);
  }
});

test('serializes a minimal moment', () => {
  const out = serializeMoment({ body: '正文', date });
  assert.equal(out, '---\ndate: 2026-10-03 15:30:00\n---\n\n正文\n');
});

test('omits the tags key entirely when there are no tags', () => {
  const out = serializeMoment({ body: '正文', date, tags: [] });
  assert.ok(!out.includes('tags:'), out);
});

test('serializes tags as a quoted list', () => {
  // Quoted uniformly, including CJK tags that would not strictly need it: one
  // code path is easier to reason about than a per-value "needs quoting" test.
  const out = serializeMoment({ body: '正文', date, tags: ['日常', '笔记'] });
  assert.ok(out.includes("tags:\n  - '日常'\n  - '笔记'"), out);
});

test('quotes tags containing YAML-significant characters', () => {
  const out = serializeMoment({ body: '正文', date, tags: ['a: b'] });
  assert.ok(out.includes("  - 'a: b'"), out);
});

test('trims surrounding whitespace from the body', () => {
  const out = serializeMoment({ body: '\n\n  正文  \n\n', date });
  assert.ok(out.endsWith('\n\n正文\n'), JSON.stringify(out));
});

test('does not add a title field', () => {
  // A moment deliberately has no title; this is the feature's core trade-off.
  const out = serializeMoment({ body: '正文', date });
  assert.ok(!out.includes('title:'), out);
});

test('round-trips a moment through serialize and parse', () => {
  const out = serializeMoment({ body: '正文内容\n第二行', date, tags: ['日常'] });
  const parsed = parseMomentFrontmatter(out);
  assert.ok(parsed);
  assert.equal(parsed.date, '2026-10-03 15:30:00');
  assert.deepEqual(parsed.tags, ['日常']);
  assert.equal(extractMomentBody(out), '正文内容\n第二行');
});

test('round-trips a tag containing a single quote', () => {
  const out = serializeMoment({ body: 'x', date, tags: ["it's"] });
  const parsed = parseMomentFrontmatter(out);
  assert.ok(parsed);
  assert.deepEqual(parsed.tags, ["it's"]);
});

test('round-trips a tag containing a colon and hash', () => {
  const out = serializeMoment({ body: 'x', date, tags: ['a: b #c'] });
  const parsed = parseMomentFrontmatter(out);
  assert.ok(parsed);
  assert.deepEqual(parsed.tags, ['a: b #c']);
});

test('parses a file with no tags', () => {
  const parsed = parseMomentFrontmatter('---\ndate: 2026-10-03 15:30:00\n---\n\n正文\n');
  assert.ok(parsed);
  assert.deepEqual(parsed.tags, []);
});

test('returns null for a file with no frontmatter', () => {
  assert.equal(parseMomentFrontmatter('just a body'), null);
});

test('returns null when the date field is missing', () => {
  assert.equal(parseMomentFrontmatter('---\ntags:\n  - a\n---\n\n正文\n'), null);
});

test('handles CRLF line endings', () => {
  const parsed = parseMomentFrontmatter('---\r\ndate: 2026-10-03 15:30:00\r\ntags:\r\n  - 日常\r\n---\r\n\r\n正文\r\n');
  assert.ok(parsed);
  assert.deepEqual(parsed.tags, ['日常']);
});

test('extracts the body without the frontmatter', () => {
  assert.equal(extractMomentBody('---\ndate: 2026-10-03 15:30:00\n---\n\n正文\n'), '正文');
});

test('returns the whole text as body when there is no frontmatter', () => {
  assert.equal(extractMomentBody('just a body'), 'just a body');
});

test('keeps multi-line structure in the body', () => {
  const body = '第一段\n\n第二段\n第三行';
  const out = serializeMoment({ body, date });
  assert.equal(extractMomentBody(out), body);
});

test('preserves hard breaks written as trailing double spaces', () => {
  // The editor emits trailing double spaces for in-paragraph breaks; a
  // serializer that trimmed line-ends would silently destroy them.
  const body = '第一行  \n第二行';
  const out = serializeMoment({ body, date });
  assert.equal(extractMomentBody(out), body);
});
