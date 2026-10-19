import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildColophonGroups, extractColophonIds, mergeColophonEntries, toggleColophonMark } from './colophon-form';

test('extracts ids from strings and id objects but ignores one-off marks', () => {
  assert.deepEqual(
    extractColophonIds(['handwritten', { id: 'ai-written', note: 'AI 起草' }, { icon: 'ri:cat-line', label: '猫' }]),
    ['handwritten', 'ai-written'],
  );
  assert.deepEqual(extractColophonIds(undefined), []);
});

test('keeps a selected mark’s note and drops deselected marks', () => {
  const original = ['handwritten', { id: 'ai-written', note: 'AI 起草' }, { id: 'ai-cowrite', note: '我主笔' }];

  assert.deepEqual(mergeColophonEntries(['ai-written'], original), [{ id: 'ai-written', note: 'AI 起草' }]);
});

test('preserves one-off marks the selector cannot edit', () => {
  const oneOff = { icon: 'ri:cat-line', label: '猫' };

  assert.deepEqual(mergeColophonEntries(['handwritten'], [oneOff]), ['handwritten', oneOff]);
  assert.deepEqual(mergeColophonEntries([], [oneOff]), [oneOff]);
});

test('emits plain ids for marks that had no original entry', () => {
  assert.deepEqual(mergeColophonEntries(['ai-written'], undefined), ['ai-written']);
  assert.deepEqual(mergeColophonEntries([], ['handwritten']), []);
});

test('toggles a mark on and off', () => {
  assert.deepEqual(toggleColophonMark([], 'handwritten'), ['handwritten']);
  assert.deepEqual(toggleColophonMark(['handwritten'], 'handwritten'), []);
});

test('selecting a mark in an exclusive group replaces its siblings', () => {
  assert.deepEqual(toggleColophonMark(['handwritten'], 'ai-written', ['handwritten', 'ai-cowrite', 'ai-written']), [
    'ai-written',
  ]);
});

test('marks outside an exclusive group are left alone', () => {
  assert.deepEqual(toggleColophonMark(['spoiler'], 'ai-written', ['handwritten', 'ai-written']), ['spoiler', 'ai-written']);
});

test('groups marks in configured order and collects ungrouped ones last', () => {
  const groups = buildColophonGroups({
    groups: {
      authorship: { label: '执笔', exclusive: true },
      notice: { label: '阅读提示' },
    },
    marks: {
      handwritten: { group: 'authorship', icon: 'ri:quill-pen-line', label: '手写' },
      spoiler: { group: 'notice', icon: 'ri:eye-off-line', label: '含剧透' },
      loose: { icon: 'ri:cat-line', label: '猫' },
    },
  });

  assert.deepEqual(
    groups.map((group) => [group.id, group.label, group.exclusive, group.choices.map((choice) => choice.id)]),
    [
      ['authorship', '执笔', true, ['handwritten']],
      ['notice', '阅读提示', false, ['spoiler']],
      ['__ungrouped__', 'Other', false, ['loose']],
    ],
  );
});

test('returns no groups when colophon is disabled or unconfigured', () => {
  assert.deepEqual(buildColophonGroups(null), []);
  assert.deepEqual(buildColophonGroups({ enabled: false, marks: { x: { icon: 'ri:cat-line', label: 'x' } } }), []);
});
