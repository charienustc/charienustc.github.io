/**
 * Unit tests for newly created post frontmatter.
 *
 * The title is free-form user input; an unquoted `": "` in it used to produce
 * a file that the CMS could write but not read back.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import matter from 'gray-matter';
import yaml from 'js-yaml';

import { generateFrontmatter } from './create-frontmatter';

function parseFrontmatter(file: string) {
  return matter(file, {
    engines: {
      yaml: {
        parse: (str) => yaml.load(str, { schema: yaml.JSON_SCHEMA }) as object,
        stringify: (obj) => yaml.dump(obj),
      },
    },
  });
}

test('quotes a title containing colon-space so the file parses back', () => {
  const title = 'OpenEP: Open-Ended Future Event Prediction';
  const { data } = parseFrontmatter(generateFrontmatter({ title, link: 'note/openep', draft: true }));

  assert.equal(data.title, title);
});

test('writes the path-derived link as the first frontmatter field', () => {
  const file = generateFrontmatter({ title: 'x', link: 'note/my-post', draft: true });

  assert.match(file, /^---\nlink: (?:'note\/my-post'|note\/my-post)\n/);
  assert.equal(parseFrontmatter(file).data.link, 'note/my-post');
});

test('keeps the nested category shape used by the repository', () => {
  const file = generateFrontmatter({ title: 'x', link: 'note/x', categories: ['笔记', '前端'], draft: true });

  assert.match(file, /categories:\n {2}- \[笔记, 前端\]/);
  assert.deepEqual(parseFrontmatter(file).data.categories, [['笔记', '前端']]);
});

test('writes date and updated as unquoted local timestamps', () => {
  const file = generateFrontmatter({ title: 'x', link: 'note/x', draft: true });

  assert.match(file, /^date: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/m);
  assert.match(file, /^updated: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/m);
});

test('preserves YAML-significant tags through a round trip', () => {
  const tags = ['a: b', '#tag', "it's", '[bracket]'];
  const { data } = parseFrontmatter(generateFrontmatter({ title: 'x', link: 'note/x', tags, draft: true }));

  assert.deepEqual(data.tags, tags);
});

test('omits draft for published posts and keeps catalog enabled', () => {
  const { data } = parseFrontmatter(generateFrontmatter({ title: 'x', link: 'note/x', draft: false }));

  assert.equal(data.draft, undefined);
  assert.equal(data.catalog, true);
});
