/**
 * Browser check for the moments tab and composer.
 *
 * Closes the loop the API checks cannot: that the tab actually appears, the
 * composer writes a real file, the list refreshes, and delete retains rather
 * than destroys. Every moment this creates is removed again on the way out.
 *
 * Usage: pnpm exec tsx cms/scripts/moments-ui-check.ts
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { chromium } from '@playwright/test';

const CMS = 'http://localhost:4322';
const ROOT = path.join('F:', 'myhomepage');
const MOMENTS = path.join(ROOT, 'src', 'content', 'moments');
const RETENTION = path.join(ROOT, 'backups', 'deleted');

const stamp = Date.now().toString(36);
const BODY = `UI测试${stamp}`;

const results: string[] = [];
const check = (name: string, pass: boolean, detail = '') =>
  results.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);

const created: string[] = [];
const retained: string[] = [];

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));

try {
  await page.goto(CMS, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  // 1. The tab exists alongside the pre-existing ones.
  const tabs = page.locator('button', { hasText: /^(overview|posts|moments)$/ });
  const tabTexts = await tabs.allInnerTexts();
  check('标签页包含 overview/posts/moments', tabTexts.length === 3, tabTexts.join(', '));

  const momentsTab = page.locator('button', { hasText: /^moments$/ }).first();
  check('moments 标签可通过文本定位', (await momentsTab.count()) === 1);

  await momentsTab.click();
  await page.waitForTimeout(2500);

  // 2. The seed moment renders.
  check('列表显示既有碎碎念', (await page.locator('text=碎碎念上线了').count()) > 0);

  // 3. Composer opens and writes.
  await page.getByRole('button', { name: '写一条' }).first().click();
  await page.waitForTimeout(1000);

  const dialog = page.locator('[role="dialog"]');
  await dialog.waitFor({ timeout: 5000 });
  check('编辑器已打开', await dialog.isVisible());

  await dialog.locator('textarea[aria-label="碎碎念正文"]').fill(BODY);
  await dialog.locator('input[aria-label="标签"]').fill('测试 ui');
  await page.waitForTimeout(400);

  // Tag chips should preview before submitting.
  const chipText = (await dialog.innerText()).replace(/\s+/g, ' ');
  check('标签芯片已预览', /#测试/.test(chipText) && /#ui/.test(chipText), chipText.slice(0, 100));

  await dialog.getByRole('button', { name: /^Publish$/ }).click();
  await page.waitForTimeout(2500);

  // 4. The file landed on disk.
  const files = await fs.readdir(MOMENTS);
  const written = files.filter((f) => f.includes(stamp));
  check('文件已写入磁盘', written.length === 1, written.join(', ') || '(未找到)');
  for (const f of written) created.push(path.join(MOMENTS, f));

  if (written.length === 1) {
    const content = await fs.readFile(path.join(MOMENTS, written[0]), 'utf-8');
    check('正文已写入', content.includes(BODY));
    check('标签已写入', content.includes('测试') && content.includes('ui'));
    check('没有 title 字段', !content.includes('title:'));
  }

  // 5. The list refreshed to show it.
  await page.waitForTimeout(1500);
  check('列表已刷新显示新条目', (await page.locator(`text=${BODY}`).count()) > 0);

  // 6. Delete retains instead of destroying.
  const item = page.locator('li', { hasText: BODY }).first();
  await item.locator('button[title="Delete moment"]').click();
  await page.waitForTimeout(1000);

  const confirmText = (
    await page
      .locator('div.fixed')
      .innerText()
      .catch(() => '')
  ).replace(/\s+/g, ' ');
  check('确认框提示保留位置', /backups\/deleted/.test(confirmText), confirmText.slice(0, 120));
  check('确认框不再声称不可撤销', !/cannot be undone|永久/i.test(confirmText));

  await page
    .getByRole('button', { name: /^Delete$/ })
    .last()
    .click();
  await page.waitForTimeout(2500);

  const gone = await fs
    .access(path.join(MOMENTS, written[0] ?? 'x'))
    .then(() => false)
    .catch(() => true);
  check('原文件已移出内容目录', gone);

  const dirs = await fs.readdir(RETENTION, { recursive: true }).catch(() => []);
  const hits = dirs.map(String).filter((f) => f.includes(stamp));
  check('副本已保留', hits.length === 1, hits.join(', ') || '(未找到)');
  for (const h of hits) retained.push(path.join(RETENTION, h));

  if (hits.length === 1) {
    const copy = await fs.readFile(path.join(RETENTION, hits[0]), 'utf-8');
    check('副本内容完整', copy.includes(BODY));
  }
} catch (e) {
  check('UI 流程未抛异常', false, e instanceof Error ? e.message.split('\n')[0] : String(e));
} finally {
  await browser.close();
  for (const f of created) await fs.rm(f, { force: true });
  for (const f of retained) await fs.rm(f, { force: true });
}

console.log(results.join('\n'));
console.log(`\n页面错误: ${errors.length === 0 ? '无' : errors.join(' | ')}`);
const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`${results.length - failed}/${results.length} passed`);
process.exit(failed === 0 ? 0 : 1);
