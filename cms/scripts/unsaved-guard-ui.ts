/**
 * Browser check for the unsaved-changes guard in the post editor.
 *
 * Covers what the native `window.confirm` it replaced could not do: offer a
 * save on the way out, and be verifiable at all — a native dialog is dismissed
 * automatically by automation, which is how the old behaviour looked like
 * "clicking close does nothing".
 *
 * Usage: pnpm exec tsx cms/scripts/unsaved-guard-ui.ts
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { chromium } from '@playwright/test';

const CMS = 'http://localhost:4322';
const CONTENT = path.join('F:', 'myhomepage', 'src', 'content', 'blog');

const stamp = Date.now().toString(36);
const REL = `guard-${stamp}.md`;
const ABS = path.join(CONTENT, REL);

await fs.writeFile(
  ABS,
  `---\ntitle: 守卫测试${stamp}\ndate: 2026-10-03 10:00:00\ncategories:\n  - [随笔]\ndraft: true\n---\n\n原始正文\n`,
  'utf-8',
);

const results: string[] = [];
const check = (name: string, pass: boolean, detail = '') =>
  results.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));

try {
  await page.goto(CMS, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await page
    .locator('button', { hasText: /^posts$/ })
    .first()
    .click();
  await page.waitForTimeout(2500);

  const openEditor = async () => {
    const row = page.locator('tr', { hasText: `守卫测试${stamp}` }).first();
    await row.waitFor({ timeout: 10000 });
    await row.locator('button[title="Edit post"]').click();
    await page.waitForTimeout(3000);
  };

  // ── No changes: closing must not prompt ────────────────────────────────
  await openEditor();
  await page.locator('button[title="Close editor"]').first().click();
  await page.waitForTimeout(1500);
  check('无改动时直接关闭，不弹确认', (await page.locator('[role="dialog"]').count()) === 0);

  // ── With changes: closing must prompt ──────────────────────────────────
  await openEditor();
  await page.locator('.bn-editor, [contenteditable="true"]').first().click();
  await page.keyboard.type(' 追加内容');
  await page.waitForTimeout(1200);
  await page.locator('button[title="Close editor"]').first().click();
  await page.waitForTimeout(1200);

  const dialog = page.locator('[role="dialog"]');
  await dialog.waitFor({ timeout: 6000 });
  const text = (await dialog.innerText()).replace(/\s+/g, ' ');
  check('有改动时弹出确认', /未保存/.test(text), text.slice(0, 60));
  check('提供三个选项', /取消/.test(text) && /不保存/.test(text) && /保存并关闭/.test(text), text.slice(0, 90));

  // ── Cancel keeps the editor open ───────────────────────────────────────
  await dialog.getByRole('button', { name: /^取消$/ }).click();
  await page.waitForTimeout(1200);
  check('取消后仍在编辑器', (await page.locator('button[title="Close editor"]').count()) > 0);
  check('取消后确认框已关闭', (await page.locator('[role="dialog"]').count()) === 0);

  // ── Discard closes without writing ─────────────────────────────────────
  await page.locator('button[title="Close editor"]').first().click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /不保存并关闭/ }).click();
  await page.waitForTimeout(2000);
  const afterDiscard = await fs.readFile(ABS, 'utf-8');
  check('不保存关闭后回到列表', (await page.locator('button', { hasText: /^posts$/ }).count()) > 0);
  check('不保存关闭未写入正文', !afterDiscard.includes('追加内容'), '');

  // ── Save and close writes, then closes ─────────────────────────────────
  await openEditor();
  await page.locator('.bn-editor, [contenteditable="true"]').first().click();
  await page.keyboard.type(' 保存并关闭内容');
  await page.waitForTimeout(1200);
  await page.locator('button[title="Close editor"]').first().click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /^保存并关闭$/ }).click();
  await page.waitForTimeout(4000);

  const afterSave = await fs.readFile(ABS, 'utf-8');
  check('保存并关闭写入了正文', afterSave.includes('保存并关闭内容'), '');
  check('保存并关闭后回到列表', (await page.locator('button', { hasText: /^posts$/ }).count()) > 0);
} catch (e) {
  check('UI 流程未抛异常', false, e instanceof Error ? e.message.split('\n')[0] : String(e));
} finally {
  await browser.close();
  await fs.rm(ABS, { force: true });
}

console.log(results.join('\n'));
console.log(`\n页面错误: ${errors.length === 0 ? '无' : errors.join(' | ')}`);
const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`${results.length - failed}/${results.length} passed`);
process.exit(failed === 0 ? 0 : 1);
