import assert from 'node:assert/strict';
import test from 'node:test';
import { preprocessShokaSyntax } from './shoka-preprocessor';

/**
 * The `^` in `{text^annotation}` is Ruby, not a superscript delimiter, so the
 * raw preprocessor must leave whole Ruby expressions untouched. Otherwise two
 * Ruby expressions on one line pair their carets across each other and produce
 * a single `<sup>` spanning both.
 */
test('repeated Ruby expressions on one line survive preprocessing', () => {
  const source = '{漢字^かんじ}的注音示例。{取り返す^とりかえす}是日语中"取回"的意思。';
  assert.equal(preprocessShokaSyntax(source), source);
});

test('super/subscript adjacent to Ruby keep their own boundaries', () => {
  // The carets/tildes outside the braces are still real super/subscript syntax;
  // only the Ruby bodies must pass through untouched.
  const source = 'x^2^{漢字^かんじ}H~2~O{熟語^=じゅくご}y^3^';
  assert.equal(preprocessShokaSyntax(source), 'x<sup>2</sup>{漢字^かんじ}H<sub>2</sub>O{熟語^=じゅくご}y<sup>3</sup>');
});

test('super/subscript-like text inside Ruby stays intact', () => {
  const source = '{漢字^か~ん~じ}{式^=x^2^}';
  assert.equal(preprocessShokaSyntax(source), source);
});

test('Ruby attributes, whole-word and emphasis-dot forms are preserved', () => {
  const source = '{漢字^かんじ}{熟語^=じゅくご}{重点^*}';
  assert.equal(preprocessShokaSyntax(source), source);
});

test('code fences, inline code and math still protect Ruby syntax', () => {
  const source = [
    '`{漢字^かんじ}x^2^H~2~O`',
    '```markdown\n{漢字^かんじ}{熟語^じゅくご}x^2^H~2~O\n```',
    '$a^{x^2}+b^{y^3}$',
    '$$\na^{x^2}+b^{y^3}\n$$',
  ].join('\n\n');
  assert.equal(preprocessShokaSyntax(source), source);
});

test('super/subscript outside Ruby is still converted', () => {
  assert.equal(preprocessShokaSyntax('x^2^ and H~2~O'), 'x<sup>2</sup> and H<sub>2</sub>O');
});

test('disabling super/subscript leaves Ruby syntax alone', () => {
  const source = '{漢字^かんじ}{熟語^じゅくご}';
  assert.equal(preprocessShokaSyntax(source, { enableSuperSub: false }), source);
});
