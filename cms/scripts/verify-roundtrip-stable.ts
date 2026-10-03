/**
 * Verify the editor round-trip is now stable across REPEATED saves.
 *
 * The original bug doubled the damage on every save, so a single-save check is
 * not enough — this saves the same post five times and asserts the file is
 * byte-identical after the first save.
 *
 * Usage: pnpm exec tsx cms/scripts/verify-roundtrip-stable.ts
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { chromium } from '@playwright/test';

const CMS = 'http://localhost:4322';
const CONTENT = path.join('F:', 'myhomepage', 'src', 'content', 'blog');
const SRC = path.join(CONTENT, 'life', 'bu-zhi-dao-qi-yi-ge-sha-ming-zi.md');

const stamp = Date.now().toString(36);
const TITLE = `稳定${stamp}`;
const REL = `stable-${stamp}.md`;
const ABS = path.join(CONTENT, REL);
const BS = String.fromCharCode(92);

const seeded = (await fs.readFile(SRC, 'utf-8'))
  .replace(/^title: .*$/m, `title: ${TITLE}`)
  .replace(/^link: .*$/m, `link: stable-${stamp}`);
await fs.writeFile(ABS, seeded, 'utf-8');

const bodyOf = (t) => t.split(/^---$/m).slice(2).join('---');
const stats = (t) => ({
  breaks: (bodyOf(t).match(/ {2}$/gm) || []).length,
  bs: bodyOf(t)
    .split('')
    .filter((c) => c === BS).length,
  bytes: t.length,
});

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));

const timeline: string[] = [];
let ok = true;
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
  await row.locator('td').last().locator('button').first().click();
  await page.waitForTimeout(3500);

  const saveBtn = page.locator('button', { hasText: /save|保存/i }).first();
  const bodyBefore = bodyOf(seeded);

  // Nudge the document between saves: with no pending change the Save button is
  // disabled, and the point of this check is repeated round-trips. Typing and
  // undoing a character leaves the text identical but exercises the serialize
  // step again.
  const editor = page.locator('[contenteditable="true"]').first();

  for (let i = 1; i <= 5; i++) {
    await editor.click({ force: true });
    await page.keyboard.press('Control+End');
    await page.keyboard.type('z');
    await page.waitForTimeout(400);
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(400);

    // Wait for the editor to register the change rather than assuming it did.
    await page.waitForFunction(
      () => {
        const b = [...document.querySelectorAll('button')].find((el) => /save|保存/i.test(el.textContent ?? ''));
        return b instanceof HTMLButtonElement && !b.disabled;
      },
      { timeout: 5000 },
    );

    await saveBtn.click();
    await page.waitForTimeout(2200);

    const now = await fs.readFile(ABS, 'utf-8');
    const s = stats(now);
    // Compare the BODY only — `updated` legitimately changes on each save.
    const sameBody = bodyOf(now) === bodyBefore;
    timeline.push(
      `第 ${i} 次保存: 硬换行=${s.breaks} 反斜杠=${s.bs} 正文字节=${s.bytes} 正文与初版一致=${sameBody ? '是' : '否'}`,
    );
    if (!sameBody || s.bs > 0) ok = false;
  }
} catch (e) {
  console.log(`执行出错: ${e instanceof Error ? e.stack?.split('\n').slice(0, 4).join('\n') : e}`);
  ok = false;
} finally {
  await browser.close();
  await fs.rm(ABS, { force: true });
}

console.log(timeline.join('\n'));
console.log();
console.log(`${ok ? 'PASS' : 'FAIL'}  反复保存后正文保持不变`);
if (errors.length) console.log(`页面错误: ${errors.join(' | ')}`);
process.exit(ok ? 0 : 1);
