import assert from 'node:assert/strict';
import test from 'node:test';
import type { Element, Root } from 'hast';
import { rehypeTableWrapper } from './rehype-table-wrapper';

function table(): Element {
  return { type: 'element', tagName: 'table', properties: {}, children: [] };
}

test('wraps a standalone table in the scroll container', () => {
  const node = table();
  const tree: Root = { type: 'root', children: [node] };
  rehypeTableWrapper()(tree);
  const wrapper = tree.children[0] as Element;
  assert.equal(tree.children.length, 1);
  assert.equal(wrapper.tagName, 'div');
  assert.equal(wrapper.properties?.class, 'markdown-table-wrapper');
  assert.equal(wrapper.children[0], node);
});

test('leaves tables already inside a wrapper alone', () => {
  const node = table();
  const existing: Element = {
    type: 'element',
    tagName: 'div',
    properties: { class: 'other markdown-table-wrapper' },
    children: [node],
  };
  const tree: Root = { type: 'root', children: [existing] };
  rehypeTableWrapper()(tree);
  assert.equal(tree.children[0], existing);
  assert.equal(existing.children[0], node);
});

test('wraps a table nested inside a blockquote', () => {
  const tree: Root = {
    type: 'root',
    children: [{ type: 'element', tagName: 'blockquote', properties: {}, children: [table()] }],
  };
  rehypeTableWrapper()(tree);
  const blockquote = tree.children[0] as Element;
  assert.equal(blockquote.tagName, 'blockquote');
  const wrapper = blockquote.children[0] as Element;
  assert.equal(wrapper.tagName, 'div');
  assert.equal(wrapper.properties?.class, 'markdown-table-wrapper');
});

test('wraps every table and leaves other elements untouched', () => {
  const paragraph: Element = { type: 'element', tagName: 'p', properties: {}, children: [] };
  const tree: Root = { type: 'root', children: [table(), paragraph, table()] };
  rehypeTableWrapper()(tree);
  assert.equal((tree.children[0] as Element).tagName, 'div');
  assert.equal(tree.children[1], paragraph);
  assert.equal((tree.children[2] as Element).tagName, 'div');
});
