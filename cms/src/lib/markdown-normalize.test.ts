/**
 * Unit tests for the editor round-trip repair.
 *
 * The shapes below are taken from a real post that was corrupted by the bug, so
 * a regression here is a regression the user would notice immediately.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { normalizeEscapedLineBreaks } from './markdown-normalize';

const BS = String.fromCharCode(92);

test('converts a line-final backslash to a trailing double space', () => {
  assert.equal(normalizeEscapedLineBreaks(`AAA${BS}\nBBB`), 'AAA  \nBBB');
});

test('leaves an already-correct body alone', () => {
  const body = 'AAA  \nBBB\n\nCCC';
  assert.equal(normalizeEscapedLineBreaks(body), body);
});

test('drops a bare backslash line without leaving a blank line behind', () => {
  // BlockNote writes the break marker on its own line when there is no text to
  // escape. Removing just the backslash would leave two newlines and split the
  // stanza into two paragraphs.
  assert.equal(normalizeEscapedLineBreaks(`AAA\n${BS}\nBBB`), 'AAA\nBBB');
});

test('collapses the doubling that made the original post so messy', () => {
  // The measured failure: 33 breaks came back as 66 markers after one save.
  // Each break must survive as exactly one hard break, not two.
  const doubled = `今天下雨了${BS}\n${BS}\n从凌晨就开始下${BS}\n${BS}\n不大不小`;
  assert.equal(normalizeEscapedLineBreaks(doubled), '今天下雨了  \n从凌晨就开始下  \n不大不小');
});

test('is idempotent, so saving repeatedly cannot change the file', () => {
  const once = normalizeEscapedLineBreaks(`A${BS}\nB${BS}\nC`);
  assert.equal(normalizeEscapedLineBreaks(once), once);
  assert.equal(normalizeEscapedLineBreaks(normalizeEscapedLineBreaks(once)), once);
});

test('preserves paragraph structure across stanzas', () => {
  const body = `今天下雨了${BS}\n从凌晨就开始下\n\n后来雨密起来${BS}\n梧桐就开始说话了`;
  assert.equal(normalizeEscapedLineBreaks(body), '今天下雨了  \n从凌晨就开始下\n\n后来雨密起来  \n梧桐就开始说话了');
});

test('keeps leading indentation on a rewritten line', () => {
  // The two spaces added are a hard break, not indentation — the line's own
  // indent must survive so the author's layout is not silently reflowed.
  assert.equal(normalizeEscapedLineBreaks(`  缩进${BS}\n下一行`), '  缩进  \n下一行');
});

test('does not touch a backslash that is not at the end of a line', () => {
  const body = `示例：\`${BS}\` 反斜杠\n下一行`;
  assert.equal(normalizeEscapedLineBreaks(body), body);
});

test('preserves a shell continuation inside a fenced code block', () => {
  const body = ['```bash', `curl ${BS}`, '  --data x', '```', '正文'].join('\n');
  assert.equal(normalizeEscapedLineBreaks(body), body);
});

test('preserves a Python continuation inside a fenced code block', () => {
  const body = ['```python', `total = a + ${BS}`, '    b', '```'].join('\n');
  assert.equal(normalizeEscapedLineBreaks(body), body);
});

test('handles tilde fences as well as backtick fences', () => {
  const body = ['~~~', `line ${BS}`, '~~~'].join('\n');
  assert.equal(normalizeEscapedLineBreaks(body), body);
});

test('resumes normalizing after a code fence closes', () => {
  const body = ['```', `inside ${BS}`, '```', `outside${BS}`, 'end'].join('\n');
  assert.equal(normalizeEscapedLineBreaks(body), ['```', `inside ${BS}`, '```', 'outside  ', 'end'].join('\n'));
});

test('preserves an indented code block', () => {
  const body = ['正文', `    indented ${BS}`, '继续'].join('\n');
  assert.equal(normalizeEscapedLineBreaks(body), body);
});

test('handles an empty body', () => {
  assert.equal(normalizeEscapedLineBreaks(''), '');
});

test('terminates on a pathological all-backslash body', () => {
  // Guards the strip step: every line is a bare marker, so every line is
  // dropped and nothing is left. The point is that it neither spins nor
  // invents content.
  const body = [BS, BS, BS].join('\n');
  assert.equal(normalizeEscapedLineBreaks(body), '');
});
