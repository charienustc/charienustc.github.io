/**
 * Unit tests for the commit-message helpers.
 *
 * These cover the two places a one-click publish can silently do the wrong
 * thing: mangling a title into a doubled prefix, and letting a shell-hostile
 * scope reach git.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildSubject, defaultSubjectForTitle, MAX_SUBJECT_LENGTH, summarizeCommandFailure } from './commit-message';

test('defaultSubjectForTitle prefixes a plain post title', () => {
  assert.equal(defaultSubjectForTitle('时序数据库入门'), 'content: 时序数据库入门');
});

test('defaultSubjectForTitle collapses whitespace before using the title', () => {
  assert.equal(defaultSubjectForTitle('  多   余\n空白  '), 'content: 多 余 空白');
});

test('defaultSubjectForTitle falls back when the title is empty', () => {
  assert.equal(defaultSubjectForTitle(''), 'content: 更新文章');
  assert.equal(defaultSubjectForTitle('   '), 'content: 更新文章');
});

test('defaultSubjectForTitle leaves an existing conventional prefix alone', () => {
  // Pressing publish twice must not yield `feat: feat: ...`.
  assert.equal(defaultSubjectForTitle('feat(nav): add the indicator'), 'feat(nav): add the indicator');
});

test('defaultSubjectForTitle never exceeds the git subject cap', () => {
  const subject = defaultSubjectForTitle('x'.repeat(MAX_SUBJECT_LENGTH * 2));
  assert.equal(subject.length, MAX_SUBJECT_LENGTH);
});

test('buildSubject joins type, scope and description', () => {
  assert.deepEqual(buildSubject('feat', 'nav', 'add the indicator'), { subject: 'feat(nav): add the indicator' });
});

test('buildSubject omits the parentheses when there is no scope', () => {
  assert.deepEqual(buildSubject('content', '', 'update a post'), { subject: 'content: update a post' });
});

test('buildSubject collapses whitespace in the description', () => {
  assert.deepEqual(buildSubject('fix', 'nav', '  make   it  glide '), { subject: 'fix(nav): make it glide' });
});

test('buildSubject rejects an empty description', () => {
  const result = buildSubject('feat', 'nav', '   ');
  assert.ok('error' in result);
});

test('buildSubject rejects a scope that could reach the shell or break the prefix', () => {
  for (const scope of ['Nav', 'na v', 'nav)', 'nav); rm -rf /', '$(whoami)', '`id`', 'nav:']) {
    const result = buildSubject('feat', scope, 'x');
    assert.ok('error' in result, `scope ${JSON.stringify(scope)} should be rejected`);
  }
});

test('buildSubject accepts every conventional-commit type this repo uses', () => {
  for (const type of ['content', 'docs', 'feat', 'fix', 'style', 'chore']) {
    const result = buildSubject(type, 'nav', 'x');
    assert.deepEqual(result, { subject: `${type}(nav): x` });
  }
});

test('buildSubject enforces the git subject cap', () => {
  const result = buildSubject('feat', 'nav', 'x'.repeat(MAX_SUBJECT_LENGTH));
  assert.ok('error' in result);
});

test('summarizeCommandFailure prefers stderr and falls back to stdout', () => {
  assert.equal(summarizeCommandFailure('biome: 3 errors', 'ignored'), 'biome: 3 errors');
  assert.equal(summarizeCommandFailure('', 'biome: 3 errors'), 'biome: 3 errors');
  assert.match(summarizeCommandFailure('', ''), /没有输出任何错误信息/);
});

test('summarizeCommandFailure strips control bytes that would break the dialog', () => {
  assert.equal(summarizeCommandFailure('a\u001b[31mb\u0000c', ''), 'a[31mbc');
});
