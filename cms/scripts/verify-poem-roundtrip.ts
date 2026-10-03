/**
 * Verify the cleaned poem survives a CMS editor round-trip.
 *
 * Copies the real post, opens it in the editor, saves without typing, and
 * compares. Success = the stanzas and in-stanza breaks are unchanged and no
 * backslashes come back.
 *
 * Operates on a COPY so the real post is never at risk.
 *
 * Usage: pnpm exec tsx cms/scripts/verify-poem-roundtrip.ts
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { chromium } from '@playwright/test';

const CMS = 'http://localhost:4322';
const CONTENT = path.join('F:', 'myhomepage', 'src', 'content', 'blog');
const SRC = path.join(CONTENT, 'life', 'bu-zhi-dao-qi-yi-ge-sha-ming-zi.md');

const stamp = Date.now().toString(36);
const TITLE = `诗往返${stamp}`;
const REL = `poem-rt-${stamp}.md`;
const ABS = path.join(CONTENT, REL);

// Copy the real poem, swapping in a unique title/link so the harness can find it.
const original = await fs.readFile(SRC, 'utf-8');
const seeded = original.replace(/^title: .*$/m, `title: ${TITLE}`).replace(/^link: .*$/m, `link: poem-rt-${stamp}`);
await fs.writeFile(ABS, seeded, 'utf-8');

const BS = String.fromCharCode(92);
const countBreaks = (text) => {
  const body = text.split(/^---$/m).slice(2).join('---');
  return {
    trailingSpaces: (body.match(/ {2}$/gm) || []).length,
    backslashes: body.split('').filter((c) => c === BS).length,
    stanzas: body.trim().split(/\n\s*\n/).length,
  };
};

const before = countBreaks(seeded);
console.log('保存前:', JSON.stringify(before));

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));

let pass = false;
try {
  await page.goto(CMS, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page
    .locator('button', { hasText: /^posts$/ })
    .first()
    .click();
  await page.waitForTimeout(1800);

  const row = page.locator('tr', { hasText: TITLE }).first();
  await row.waitFor({ timeout: 8000 });
  await row.locator('td').last().locator('button').first().click();
  await page.waitForTimeout(3000);

  const saveBtn = page.locator('button', { hasText: /save|保存/i }).first();
  if (await saveBtn.isVisible().catch(() => false)) {
    await saveBtn.click();
    await page.waitForTimeout(3000);
  }

  const afterText = await fs.readFile(ABS, 'utf-8');
  const after = countBreaks(afterText);
  console.log('保存后:', JSON.stringify(after));

  const stanzasSame = after.stanzas === before.stanzas;
  const breaksPreserved = after.trailingSpaces === before.trailingSpaces;
  const noBackslash = after.backslashes === 0;

  console.log();
  console.log(`${stanzasSame ? 'PASS' : 'FAIL'}  段数不变 (${before.stanzas} -> ${after.stanzas})`);
  console.log(`${breaksPreserved ? 'PASS' : 'FAIL'}  段内硬换行数不变 (${before.trailingSpaces} -> ${after.trailingSpaces})`);
  console.log(`${noBackslash ? 'PASS' : 'FAIL'}  没引入反斜杠 (${after.backslashes})`);

  pass = stanzasSame && breaksPreserved && noBackslash;

  if (!pass) {
    console.log('\n--- 保存后的正文 ---');
    console.log(afterText.split(/^---$/m).slice(2).join('---').slice(0, 500));
  }
} catch (e) {
  console.log(`执行出错: ${e instanceof Error ? e.message.split('\n')[0] : e}`);
} finally {
  await browser.close();
  await fs.rm(ABS, { force: true });
}

if (errors.length) console.log(`页面错误: ${errors.join(' | ')}`);
console.log(`\n结论: ${pass ? '清洗后的文件可以安全地反复编辑' : '仍有往返损失，需要修 write.ts'}`);
process.exit(pass ? 0 : 1);
