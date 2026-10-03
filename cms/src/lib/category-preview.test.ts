/**
 * Unit tests for the category path preview.
 *
 * The behaviour pinned here is load-bearing twice over: the dialog shows it to
 * the user as a promise about where the post will land, and the server decides
 * independently. If these two drift, the preview becomes a lie that is worse
 * than no preview — so the cases below mirror `generateFilePath` in
 * `cms/src/api/create.ts` deliberately.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { CustomCategory } from '@/hooks/useCustomCategories';
import { categoriesToCreate, mergeCategoryOptions, previewCategoryPath, resolveCategory } from './category-preview';

const CATEGORY_MAP = { 示例: 'sample', 随笔: 'life', 笔记: 'note', 周刊: 'weekly', 探索: 'explore' };

const noCustom: CustomCategory[] = [];

/** Stand-in for the dialog's `generateCategorySlug`, which needs `node_modules`. */
const fakeSlug = (name: string) => (name === '前端' ? 'qian-duan' : '');

test('resolveCategory matches a configured name exactly', () => {
  const resolution = resolveCategory('笔记', CATEGORY_MAP, noCustom);
  assert.deepEqual(resolution, { kind: 'existing', name: '笔记', slug: 'note' });
});

test('resolveCategory treats an unmapped name as new', () => {
  const resolution = resolveCategory('算法', CATEGORY_MAP, noCustom);
  assert.deepEqual(resolution, { kind: 'new', name: '算法', slug: '' });
});

test('resolveCategory does not reuse a name that only differs by case', () => {
  // The server does `categoryMap[cat]` with no normalisation, so `note` is a
  // genuinely new key even though `笔记` maps to the same slug. Matching loosely
  // here would predict a reuse the server would not perform.
  assert.equal(resolveCategory('note', CATEGORY_MAP, noCustom)?.kind, 'new');
});

test('resolveCategory trims the typed value before matching', () => {
  // The chip carries the name the user typed; surrounding whitespace is not
  // part of it, and the server would otherwise create a category named " 笔记 ".
  assert.deepEqual(resolveCategory('  笔记  ', CATEGORY_MAP, noCustom), {
    kind: 'existing',
    name: '笔记',
    slug: 'note',
  });
});

test('resolveCategory returns null for an empty or blank name', () => {
  assert.equal(resolveCategory('', CATEGORY_MAP, noCustom), null);
  assert.equal(resolveCategory('   ', CATEGORY_MAP, noCustom), null);
});

test('resolveCategory lets a custom mapping win over the configured map', () => {
  // Mirrors create.ts: customMappings is checked before categoryMap, so a slug
  // edited in the dialog is the one that reaches the filesystem.
  const custom: CustomCategory[] = [{ name: '笔记', slug: 'bij' }];
  assert.deepEqual(resolveCategory('笔记', CATEGORY_MAP, custom), { kind: 'new', name: '笔记', slug: 'bij' });
});

test('resolveCategory ignores a custom mapping whose slug was cleared', () => {
  // An empty slug is not a usable path segment. Falling through to the normal
  // lookup is the honest answer; honouring it would produce a category at "".
  const custom: CustomCategory[] = [{ name: '笔记', slug: '  ' }];
  assert.equal(resolveCategory('笔记', CATEGORY_MAP, custom)?.kind, 'existing');
});

test('previewCategoryPath joins each category as one path segment', () => {
  const preview = previewCategoryPath(['笔记', '前端'], CATEGORY_MAP, noCustom, fakeSlug);
  assert.deepEqual(preview.segments, ['note', 'qian-duan']);
  assert.deepEqual(
    preview.resolutions.map((r) => r.kind),
    ['existing', 'new'],
  );
});

test('previewCategoryPath falls back to a placeholder when no slug can be generated', () => {
  const preview = previewCategoryPath(['笔记', '某个没有拼音的名字'], CATEGORY_MAP, noCustom, fakeSlug);
  assert.deepEqual(preview.segments, ['note', '…']);
  assert.equal(preview.resolutions.length, 2);
});

test('previewCategoryPath yields no segments when nothing is selected', () => {
  // create.ts takes the `${slug}.md` branch here — the post sits at the content
  // root rather than in a category directory.
  assert.deepEqual(previewCategoryPath([], CATEGORY_MAP, noCustom, fakeSlug).segments, []);
});

test('mergeCategoryOptions puts configured names first and drops duplicates', () => {
  const merged = mergeCategoryOptions(CATEGORY_MAP, ['算法', '笔记', '探索']);
  assert.deepEqual(merged, ['示例', '随笔', '笔记', '周刊', '探索', '算法']);
});

test('mergeCategoryOptions keeps names only seen in posts', () => {
  // A name a post uses but the config does not map is still one click away —
  // removing it from the chips would hide a category the blog actually renders.
  assert.deepEqual(mergeCategoryOptions({}, ['旧分类']), ['旧分类']);
});

test('mergeCategoryOptions survives an empty blog', () => {
  // The regression this guards: driving the chips off post categories alone
  // left the list blank once every post was deleted, so the names that were
  // still valid were the ones no longer shown.
  assert.deepEqual(mergeCategoryOptions(CATEGORY_MAP, []), Object.keys(CATEGORY_MAP));
});

// The real generator, matching what the component passes in: a hand-rolled
// ASCII-only stub would drop CJK names to an empty slug and hide the behaviour
// these tests exist to pin.
import { generateCategorySlug as slugFor } from './category';

test('categoriesToCreate lists only the categories that do not exist yet', () => {
  // The whole point of the confirmation: reusing an existing category has no
  // side effect and must not be gated, or every post becomes a two-step.
  const resolutions = [
    { kind: 'existing' as const, name: '随笔', slug: 'life' },
    { kind: 'new' as const, name: '算法', slug: '' },
  ];
  assert.deepEqual(categoriesToCreate(resolutions, slugFor), [{ name: '算法', slug: slugFor('算法') }]);
});

test('categoriesToCreate returns nothing when every category already exists', () => {
  const resolutions = [
    { kind: 'existing' as const, name: '随笔', slug: 'life' },
    { kind: 'existing' as const, name: '笔记', slug: 'note' },
  ];
  assert.deepEqual(categoriesToCreate(resolutions, slugFor), []);
});

test('categoriesToCreate returns nothing for an empty selection', () => {
  // A post with no categories sits at the content root and creates nothing.
  assert.deepEqual(categoriesToCreate([], slugFor), []);
});

test('categoriesToCreate uses the user-edited slug when there is one', () => {
  // The chip lets the slug be edited before submit; the confirmation must show
  // the value that will actually be written, not a regenerated one.
  const resolutions = [{ kind: 'new' as const, name: '算法', slug: 'my-custom-slug' }];
  assert.deepEqual(categoriesToCreate(resolutions, slugFor), [{ name: '算法', slug: 'my-custom-slug' }]);
  assert.notEqual(slugFor('算法'), 'my-custom-slug', 'the edit must be what differs from the generated value');
});

test('categoriesToCreate falls back to the generator for a slug-less new category', () => {
  // A name typed but not yet added has no slug; the server will generate one,
  // so the confirmation shows the same value rather than an empty string.
  const resolutions = [{ kind: 'new' as const, name: 'react-hooks', slug: '' }];
  assert.deepEqual(categoriesToCreate(resolutions, slugFor), [{ name: 'react-hooks', slug: 'react-hooks' }]);
});

test('categoriesToCreate preserves the selection order', () => {
  // The list is read top-down against the chips the user just picked.
  const resolutions = [
    { kind: 'new' as const, name: '第一个', slug: 'a' },
    { kind: 'new' as const, name: '第二个', slug: 'b' },
  ];
  assert.deepEqual(
    categoriesToCreate(resolutions, slugFor).map((c) => c.name),
    ['第一个', '第二个'],
  );
});

test('categoriesToCreate does not mutate its input', () => {
  const resolutions = [{ kind: 'new' as const, name: 'x', slug: '' }];
  const snapshot = JSON.parse(JSON.stringify(resolutions));
  categoriesToCreate(resolutions, slugFor);
  assert.deepEqual(JSON.parse(JSON.stringify(resolutions)), snapshot);
});
