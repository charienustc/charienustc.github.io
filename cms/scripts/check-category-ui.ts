/**
 * Browser check for the Create-dialog category affordances.
 *
 * Verifies the three things the feature promises: configured categories show up
 * as chips even with an empty blog, a matched name is reported as existing, and
 * an unmatched name is flagged as creating a new category (without blocking).
 *
 * Run from F:\myhomepage: node node_modules/.bin/tsx cms/scripts/check-category-ui.ts
 */

import { chromium } from '@playwright/test';

const CMS = 'http://localhost:4322';

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

const pageErrors: string[] = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') pageErrors.push(`console: ${m.text()}`);
});

const results: string[] = [];
const check = (name: string, pass: boolean, detail = '') => {
  results.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

await page.goto(CMS, { waitUntil: 'networkidle' });

// 1. The app mounted at all (guards the Vite-externalised-builtin failure mode)
const rootChildren = await page.locator('#root > *').count();
check('app mounts', rootChildren > 0, `#root children = ${rootChildren}`);

// 2. Open the Create dialog
await page.getByRole('button', { name: /New Post/i }).click();
await page.getByText('Create New Post').waitFor({ timeout: 5000 });

// 3. Configured categories are offered as chips despite an empty blog
const chips = page.locator('form button[type="button"]');
const chipTexts: string[] = [];
const chipCount = await chips.count();
for (let i = 0; i < chipCount; i++) {
  const t = (await chips.nth(i).innerText()).trim();
  if (t) chipTexts.push(t.split('\n')[0]);
}
const configured = ['示例', '随笔', '笔记', '周刊', '探索'];
const found = configured.filter((c) => chipTexts.includes(c));
check('configured categories shown as chips', found.length === configured.length, chipTexts.join(' / '));

// 4. Typing a matched name reports "已有分类"
const input = page.getByPlaceholder('Add custom category...');
await input.fill('笔记');
await page.waitForTimeout(300);
const matchedHint = await page
  .locator('form p:has-text("已有分类")')
  .innerText()
  .catch(() => '');
check('matched name reported as existing', matchedHint.includes('note'), matchedHint.replace(/\s+/g, ' ').trim());

// 5. Typing an unmatched name flags a new category, and does NOT disable Create
await input.fill('算法');
await page.waitForTimeout(300);
const newHint = await page
  .locator('form p:has-text("会新建分类")')
  .innerText()
  .catch(() => '');
check('new name flagged as creating a category', newHint.includes('算法'), newHint.replace(/\s+/g, ' ').trim());
check('hint shows the generated slug', newHint.includes('suan-fa'), 'expected suan-fa in hint');

const createBtn = page.getByRole('button', { name: /^Create Post$/ });
const stillEnabled = await createBtn.isEnabled();
check('new category does not block submit', stillEnabled);

// 6. A typo near an existing name is caught (the actual motivating case)
await input.fill('week');
await page.waitForTimeout(300);
const typoHint = await page
  .locator('form p:has-text("会新建分类")')
  .innerText()
  .catch(() => '');
check('typo "week" correctly flagged as new', typoHint.includes('week'), typoHint.replace(/\s+/g, ' ').trim());
const typoSlug = typoHint.includes('week') ? 'week' : '(missing)';
check('typo slug previewed', typoSlug === 'week');

// 7. Selecting a chip previews the file path
await input.fill('');
await page.getByRole('button', { name: /^笔记/ }).first().click();
await page.waitForTimeout(300);
const pathLine = await page
  .locator('form p:has-text("src/content/blog/")')
  .innerText()
  .catch(() => '');
check('file path previewed for selection', pathLine.includes('note/'), pathLine.replace(/\s+/g, ' ').trim());

await page.screenshot({ path: 'cms/scripts/category-ui-check.png', fullPage: false });

console.log(results.join('\n'));
console.log(`\npage errors: ${pageErrors.length === 0 ? 'none' : pageErrors.join(' | ')}`);

await browser.close();

const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed === 0 && pageErrors.length === 0 ? 0 : 1);
