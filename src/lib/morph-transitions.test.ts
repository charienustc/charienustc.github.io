import assert from 'node:assert/strict';
import test from 'node:test';
import { postTitleMorphName } from './morph-transitions';

test('postTitleMorphName keeps plain slugs unchanged', () => {
  assert.equal(postTitleMorphName('my-post'), 'post-title-my-post');
  assert.equal(postTitleMorphName('a_b-c9'), 'post-title-a_b-c9');
});

test('postTitleMorphName sanitizes nested slugs into valid CSS idents', () => {
  // view-transition-name is a <custom-ident>; a '/' (nested content dirs) makes
  // the declaration invalid and the CSS parser silently drops it, so the morph
  // pair never forms.
  assert.equal(postTitleMorphName('sample/markdown-syntax-demo'), 'post-title-sample-markdown-syntax-demo');
  assert.equal(postTitleMorphName('note/encrypted-post-demo'), 'post-title-note-encrypted-post-demo');
});

test('postTitleMorphName replaces non-ident punctuation but keeps letters and digits', () => {
  assert.equal(postTitleMorphName('hello world'), 'post-title-hello-world');
  assert.equal(postTitleMorphName('a.b:c#d%e+f'), 'post-title-a-b-c-d-e-f');
  // Non-ASCII letters are valid ident code points and must survive.
  assert.equal(postTitleMorphName('笔记/前端'), 'post-title-笔记-前端');
});
