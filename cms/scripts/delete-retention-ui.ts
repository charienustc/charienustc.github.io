/**
 * Browser check for delete retention through the real CMS interface.
 *
 * The integration check drives the API directly; this one clicks the delete
 * button in the table like a user would, which is the path the mis-click
 * happened on.
 *
 * Usage: pnpm exec tsx cms/scripts/delete-retention-ui.ts
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { chromium } from '@playwright/test';

const CMS = 'http://localhost:4322';
const CONTENT = path.join('F:', 'myhomepage', 'src', 'content', 'blog');
const RETENTION = path.join('F:', 'myhomepage', 'backups', 'deleted');

const stamp = Date.now().toString(36);
const TITLE = `删除测试${stamp}`;
const REL = `uitest-${stamp}.md`;
const ABS = path.join(CONTENT, REL);

await fs.writeFile(
  ABS,
  `---\ntitle: ${TITLE}\ndate: 2026-10-03 10:00:00\ncategories:\n  - [随笔]\ndraft: true\n---\n\n正文\n`,
  'utf-8',
);

const results: string[] = [];
const check = (name: string, pass: boolean, detail = '') =>
  results.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);

const retained: string[] = [];
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

  const row = page.locator('tr', { hasText: TITLE }).first();
  await row.waitFor({ timeout: 10000 });

  // The actions cell holds five icon-only buttons. Select by title rather than
  // position: the delete icon sits directly after Publish, which is precisely
  // how the mis-click that motivated this change happened.
  const actions = row.locator('td').last();
  const buttonCount = await actions.locator('button').count();
  check('行内有 5 个操作按钮', buttonCount === 5, `实际 ${buttonCount}`);

  const deleteBtn = actions.locator('button[title="Delete post"]');
  check('删除按钮可通过 title 定位', (await deleteBtn.count()) === 1);

  await deleteBtn.click();
  await page.waitForTimeout(1200);

  // The confirmation must not still claim the action is irreversible.
  const dialog = page.locator('[role="dialog"]');
  await dialog.waitFor({ timeout: 5000 });
  const dialogText = (await dialog.innerText().catch(() => '')).replace(/\s+/g, ' ');
  check('确认框已打开', dialogText.includes(TITLE), dialogText.slice(0, 80));
  check('文案不再声称不可撤销', !/cannot be undone|永久/i.test(dialogText), '');
  check('文案说明了保留位置', /backups\/deleted/.test(dialogText), '');
  check('提示了 Git 层面仍是删除', /Git/.test(dialogText), '');

  const beforeShot = await page.screenshot({ path: 'cms/scripts/delete-dialog.png' });
  check('截图已保存', beforeShot.length > 0);

  // Confirm.
  await dialog.getByRole('button', { name: /^Delete$/ }).click();
  await page.waitForTimeout(2500);

  const gone = await fs
    .access(ABS)
    .then(() => false)
    .catch(() => true);
  check('原文件已从内容目录移走', gone, REL);

  const dirs = await fs.readdir(RETENTION, { recursive: true }).catch(() => []);
  const hit = dirs.map(String).filter((f) => f.includes(`uitest-${stamp}`));
  check('副本已保留', hit.length === 1, hit.join(', ') || '(未找到)');
  for (const h of hit) retained.push(path.join(RETENTION, h));

  if (hit.length === 1) {
    const copy = await fs.readFile(path.join(RETENTION, hit[0]), 'utf-8');
    check('副本内容完整', copy.includes(`title: ${TITLE}`) && copy.includes('正文'));
  }

  // The toast should name where the file went.
  const toast = await page
    .locator('[data-sonner-toast], .sonner-toast, li[role="status"]')
    .first()
    .innerText()
    .catch(() => '');
  check('提示里给出了保留路径', /backups/.test(toast), toast.replace(/\s+/g, ' ').slice(0, 120));
} catch (e) {
  check('UI 流程未抛异常', false, e instanceof Error ? e.message.split('\n')[0] : String(e));
} finally {
  await browser.close();
  await fs.rm(ABS, { force: true });
  for (const r of retained) await fs.rm(r, { force: true });
  await fs.rmdir(path.join(RETENTION, 'uitest')).catch(() => {});
}

console.log(results.join('\n'));
console.log(`\n页面错误: ${errors.length === 0 ? '无' : errors.join(' | ')}`);
const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`${results.length - failed}/${results.length} passed`);
process.exit(failed === 0 ? 0 : 1);
