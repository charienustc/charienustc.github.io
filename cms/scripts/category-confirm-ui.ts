/**
 * Browser check for the new-category confirmation step.
 *
 * The rule under test has two halves and both matter: a new category must be
 * confirmed before anything is written, and an existing one must NOT be — a
 * gate that fires on every post would just train the writer to click through.
 *
 * Everything this creates is removed again on the way out, including any
 * `categoryMap` entry it added to `config/site.yaml`.
 *
 * Usage: pnpm exec tsx cms/scripts/category-confirm-ui.ts
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { chromium } from '@playwright/test';

const CMS = 'http://localhost:4322';
const ROOT = path.join('F:', 'myhomepage');
const CONTENT = path.join(ROOT, 'src', 'content', 'blog');
const CONFIG = path.join(ROOT, 'config', 'site.yaml');

const stamp = Date.now().toString(36);
const NEW_CATEGORY = `临时分类${stamp}`;
const EXISTING_CATEGORY = '随笔';

const results: string[] = [];
const check = (name: string, pass: boolean, detail = '') =>
  results.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);

const configBefore = await fs.readFile(CONFIG, 'utf-8');
const created: string[] = [];

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));

/**
 * Every file under the content dir whose path carries this run's stamp.
 *
 * Recursive on purpose: a post with a category lands in that category's
 * subdirectory, so listing only the content root reports a false "not found".
 */
async function findStamped(): Promise<string[]> {
  const entries = (await fs.readdir(CONTENT, { recursive: true }).catch(() => [])) as string[];
  const hits = entries.map(String).filter((p) => p.includes(stamp));
  // Only files: the walk also yields the category directory itself, and the
  // caller removes these paths individually.
  const files: string[] = [];
  for (const hit of hits) {
    const stat = await fs.stat(path.join(CONTENT, hit)).catch(() => null);
    if (stat?.isFile()) files.push(hit);
  }
  return files;
}

/**
 * Open the Create dialog and fill in the title.
 *
 * Waits for the previous dialog to be gone before clicking, rather than
 * sleeping: after a successful create the overlay is still dismissing, and
 * clicking through it times out on the backdrop.
 */
async function openDialog(title: string) {
  await page
    .locator('[role="dialog"]')
    .waitFor({ state: 'detached', timeout: 10000 })
    .catch(() => {});
  await returnToDashboard();
  await page.getByRole('button', { name: /New Post/ }).click();
  const dialog = page.locator('[role="dialog"]');
  await dialog.waitFor({ timeout: 8000 });
  await dialog.locator('#title').fill(title);
  return dialog;
}

/**
 * Leave the post editor if a successful create opened it.
 *
 * `onSuccess` opens the new post for writing rather than returning to the
 * list, so a second create has to come back first. Detected by the dashboard's
 * own New Post button rather than by URL, so a layout change cannot silently
 * turn this into a no-op.
 */
async function returnToDashboard() {
  if ((await page.getByRole('button', { name: /New Post/ }).count()) > 0) return;

  // A freshly created post opens in the editor with unsaved changes, and the
  // editor refuses to close while that is true. Save first so the close is not
  // silently swallowed — this mirrors what a user has to do.
  const save = page.getByRole('button', { name: /^Save$/ });
  if ((await save.count()) > 0) {
    await save.first().click();
    await page.waitForFunction(
      () => {
        const b = [...document.querySelectorAll('button')].find((el) => el.textContent?.trim() === 'Save');
        return b instanceof HTMLButtonElement && b.disabled;
      },
      { timeout: 15000 },
    );
  }

  // The exit control is icon-only and has no accessible name, so it is located
  // by title. Position would be fragile and text would match nothing.
  await page.locator('button[title="Close editor"]').first().click();
  await page.getByRole('button', { name: /New Post/ }).waitFor({ timeout: 15000 });
}

/**
 * Type a category name and press the add button beside the input.
 *
 * The button is located relative to its input rather than by icon: Iconify
 * renders a bare <svg class="iconify"> with no data-icon attribute, so an
 * icon-based selector silently matches nothing.
 */
async function addCategoryChip(dialog: ReturnType<typeof page.locator>, name: string) {
  const input = dialog.locator('input[placeholder="Add custom category..."]');
  await input.fill(name);
  await input.locator('xpath=following-sibling::button').click();
  await page.waitForTimeout(600);
}

async function closeDialog() {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);
}

let currentStep = 'start';
try {
  currentStep = 'goto';
  await page.goto(CMS, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  // ── Half 1: a new category must be confirmed ──────────────────────────
  currentStep = 'open dialog 1';
  let dialog = await openDialog(`新分类测试${stamp}`);
  await addCategoryChip(dialog, NEW_CATEGORY);

  await dialog.getByRole('button', { name: /Create Post/ }).click();
  await page.waitForTimeout(1500);

  const confirmText = (await dialog.innerText()).replace(/\s+/g, ' ');
  check('弹出确认步骤', /会新建 1 个分类/.test(confirmText), confirmText.slice(0, 70));
  check('确认框列出分类名', confirmText.includes(NEW_CATEGORY), '');
  check('确认框说明会写配置文件', /config\/site\.yaml/.test(confirmText), '');
  check('确认框说明会生成分类页', /生成分类页/.test(confirmText), '');
  check('仍停留在弹窗内（未提交）', (await dialog.count()) === 1, '');

  const configMid = await fs.readFile(CONFIG, 'utf-8');
  check('确认前未改动 config', configMid === configBefore, '');

  // Back out, then prove nothing was written.
  await dialog.getByRole('button', { name: /返回修改/ }).click();
  await page.waitForTimeout(1000);
  const backText = (await dialog.innerText()).replace(/\s+/g, ' ');
  check('返回后回到了表单', /Create New Post/.test(backText), backText.slice(0, 50));
  await closeDialog();

  const configAfterBack = await fs.readFile(CONFIG, 'utf-8');
  check('返回后 config 仍未改动', configAfterBack === configBefore, '');
  const strayFiles = await findStamped();
  check('返回后没有生成文件', strayFiles.length === 0, strayFiles.join(', '));

  // ── Half 2: an existing category must NOT be confirmed ────────────────
  currentStep = 'open dialog 2 (existing category)';
  dialog = await openDialog(`已有分类测试${stamp}`);
  await dialog
    .locator('button', { hasText: new RegExp(`^${EXISTING_CATEGORY}$`) })
    .first()
    .click();
  await page.waitForTimeout(600);
  await dialog.getByRole('button', { name: /Create Post/ }).click();
  await page.waitForTimeout(2500);

  // A single-step create closes the dialog; a gated one would still show it.
  check('已有分类不弹确认（弹窗已关闭）', (await page.locator('[role="dialog"]').count()) === 0, '');

  const madeFiles = await findStamped();
  check('文章已直接创建', madeFiles.length === 1, madeFiles.join(', ') || '(未找到)');
  for (const f of madeFiles) created.push(path.join(CONTENT, f));

  const configAfterExisting = await fs.readFile(CONFIG, 'utf-8');
  check('已有分类未改动 config', configAfterExisting === configBefore, '');

  // ── Half 1 (continued): confirming actually creates ───────────────────
  currentStep = 'open dialog 3 (confirm creates)';
  dialog = await openDialog(`确认创建测试${stamp}`);
  await addCategoryChip(dialog, NEW_CATEGORY);
  await dialog.getByRole('button', { name: /Create Post/ }).click();
  await page.waitForTimeout(1500);
  await dialog.getByRole('button', { name: /确认新建并创建文章/ }).click();
  await page.waitForTimeout(2500);

  check('确认后弹窗关闭', (await page.locator('[role="dialog"]').count()) === 0, '');
  const confirmFiles = await findStamped();
  check('确认后文章已创建', confirmFiles.length === 2, confirmFiles.join(', '));
  for (const f of confirmFiles) created.push(path.join(CONTENT, f));

  const configAfterConfirm = await fs.readFile(CONFIG, 'utf-8');
  check('确认后 config 已写入新分类', configAfterConfirm.includes(NEW_CATEGORY), '');
} catch (e) {
  check(`UI 流程未抛异常（失败于：${currentStep}）`, false, e instanceof Error ? e.message.split('\n')[0] : String(e));
} finally {
  await browser.close();
  for (const f of created) await fs.rm(f, { force: true });
  // Remove the scratch directories the new category created. `recursive` is
  // required: these are directories, and a plain rm throws EISDIR.
  for (const rel of (await fs.readdir(CONTENT).catch(() => [])) as string[]) {
    if (rel.includes(stamp)) await fs.rm(path.join(CONTENT, rel), { recursive: true, force: true });
  }
  // Restore config/site.yaml exactly — the create call appended a mapping.
  // Done in `finally` so a crash mid-run still puts the repo back; an earlier
  // failure here left a stray categoryMap entry behind.
  await fs.writeFile(CONFIG, configBefore, 'utf-8');

  // Report loudly if the restore did not take, rather than leaving the caller
  // to notice a dirty working tree later.
  const restored = (await fs.readFile(CONFIG, 'utf-8')) === configBefore;
  if (!restored) console.log('!! config/site.yaml 未能还原 —— 请手动检查 !!');
}

console.log(results.join('\n'));
console.log(`\n页面错误: ${errors.length === 0 ? '无' : errors.join(' | ')}`);
console.log(`config 已还原: ${(await fs.readFile(CONFIG, 'utf-8')) === configBefore}`);

const left = (await fs.readdir(CONTENT, { recursive: true }).catch(() => [])).filter((f) => String(f).includes(stamp));
console.log(`残留文件: ${left.length === 0 ? '无' : left.join(', ')}`);

const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`${results.length - failed}/${results.length} passed`);
process.exit(failed === 0 ? 0 : 1);
