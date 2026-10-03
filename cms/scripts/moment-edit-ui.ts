/**
 * Browser check for editing a moment through the CMS.
 *
 * The API check covers the endpoint; this covers the path a user actually
 * takes — click edit, see the existing text prefilled, change it, save, and
 * find the previous revision retained.
 *
 * Usage: pnpm exec tsx cms/scripts/moment-edit-ui.ts
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { chromium } from '@playwright/test';

const CMS = 'http://localhost:4322';
const ROOT = path.join('F:', 'myhomepage');
const MOMENTS = path.join(ROOT, 'src', 'content', 'moments');
const VERSIONS = path.join(ROOT, 'backups', 'versions');

const stamp = Date.now().toString(36);
const ORIGINAL = `原始文本${stamp}`;
const EDITED = `编辑后的文本${stamp}`;

const results: string[] = [];
const check = (name: string, pass: boolean, detail = '') =>
  results.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);

const created: string[] = [];
const versions: string[] = [];

// Seed a moment directly, so the edit flow starts from a known state with a
// `date` we can prove survives.
const momentId = `2026-07-01-080000-uitest${stamp}.md`;
const momentPath = path.join(MOMENTS, momentId);
await fs.writeFile(momentPath, `---\ndate: 2026-07-01 08:00:00\n---\n\n${ORIGINAL}\n`, 'utf-8');
created.push(momentPath);

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));

try {
  await page.goto(CMS, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await page
    .locator('button', { hasText: /^moments$/ })
    .first()
    .click();
  await page.waitForTimeout(2500);

  // 1. Each row offers an edit action, located by title rather than position.
  const row = page.locator('li', { hasText: ORIGINAL }).first();
  await row.waitFor({ timeout: 10000 });
  const editBtn = row.locator('button[title="Edit moment"]');
  check('编辑按钮存在', (await editBtn.count()) === 1);

  await editBtn.click();
  await page.waitForTimeout(1500);

  // 2. The composer opens in edit mode with the existing text prefilled.
  const dialog = page.locator('[role="dialog"]');
  await dialog.waitFor({ timeout: 5000 });
  const dialogText = (await dialog.innerText()).replace(/\s+/g, ' ');
  check('标题显示为编辑模式', /编辑碎碎念/.test(dialogText), dialogText.slice(0, 60));
  check('说明了旧版会保留', /backups\/versions/.test(dialogText), '');
  check('说明了发布日期不变', /发布日期不变/.test(dialogText), '');

  const textarea = dialog.locator('textarea[aria-label="碎碎念正文"]');
  await page.waitForFunction(
    () => {
      const el = document.querySelector('textarea[aria-label="碎碎念正文"]') as HTMLTextAreaElement | null;
      return el !== null && !el.disabled && el.value.length > 0;
    },
    { timeout: 8000 },
  );
  const prefilled = await textarea.inputValue();
  check('正文已预填', prefilled.includes(ORIGINAL), prefilled.slice(0, 40));

  // 3. The button reads Save, not Publish.
  check('按钮文案为 Save', /Save/.test(dialogText) && !/Publish/.test(dialogText), '');

  // 4. Change the text and save.
  await textarea.fill(EDITED);
  await page.waitForTimeout(300);
  await dialog.getByRole('button', { name: /^Save$/ }).click();
  await page.waitForTimeout(2500);

  const afterRaw = await fs.readFile(momentPath, 'utf-8');
  check('正文已改写', afterRaw.includes(EDITED), '');
  check('旧正文已消失', !afterRaw.includes(ORIGINAL), '');
  check('发布日期未变', afterRaw.includes('date: 2026-07-01 08:00:00'), '');
  check('写入了 updated', /^updated:/m.test(afterRaw), '');

  // 5. The previous revision is on disk.
  const hits = (await fs.readdir(VERSIONS, { recursive: true }).catch(() => [])).filter((f) => String(f).includes(stamp));
  check('旧版已保留', hits.length === 1, hits.join(', ') || '(未找到)');
  for (const h of hits) versions.push(path.join(VERSIONS, h));
  if (hits.length === 1) {
    const versionRaw = await fs.readFile(path.join(VERSIONS, hits[0]), 'utf-8');
    check('旧版内容完整', versionRaw.includes(ORIGINAL), '');
  }

  // 6. The list refreshes and marks the entry as edited.
  await page.waitForTimeout(1500);
  const refreshed = page.locator('li', { hasText: EDITED }).first();
  check('列表已刷新', (await refreshed.count()) > 0);
  check('列表标出已修改', (await refreshed.innerText()).includes('已改'), '');

  // 7. Reopening shows the new text, not the stale original.
  await refreshed.locator('button[title="Edit moment"]').click();
  await page.waitForTimeout(1500);
  await page.waitForFunction(
    () => {
      const el = document.querySelector('textarea[aria-label="碎碎念正文"]') as HTMLTextAreaElement | null;
      return el !== null && !el.disabled && el.value.length > 0;
    },
    { timeout: 8000 },
  );
  const reopened = await textarea.inputValue();
  check('重新打开显示最新正文', reopened.includes(EDITED), reopened.slice(0, 40));
} catch (e) {
  check('UI 流程未抛异常', false, e instanceof Error ? e.message.split('\n')[0] : String(e));
} finally {
  await browser.close();
  for (const f of created) await fs.rm(f, { force: true });
  for (const f of versions) await fs.rm(f, { force: true });
}

console.log(results.join('\n'));
console.log(`\n页面错误: ${errors.length === 0 ? '无' : errors.join(' | ')}`);
const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`${results.length - failed}/${results.length} passed`);
process.exit(failed === 0 ? 0 : 1);
