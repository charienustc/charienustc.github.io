/**
 * End-to-end check that the dialog's preview matches what the server actually
 * does. Creates throwaway posts in a scratch content dir and asserts the on-disk
 * path — the preview is only useful if these agree.
 *
 * Nothing here touches config/site.yaml: every category exercised already
 * exists there, so the server's mapping append path stays idle.
 *
 * Usage: pnpm exec tsx cms/scripts/check-category-e2e.ts
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { previewCategoryPath, resolveCategory } from '../src/lib/category-preview';
import { generateSlug } from '../src/lib/slug';

const CMS = 'http://localhost:4322';
const ROOT = 'F:\\myhomepage';
const CONTENT = path.join(ROOT, 'src', 'content', 'blog');

// Fresh names so the run is repeatable.
const stamp = Date.now().toString(36);
const results: string[] = [];
const check = (name: string, pass: boolean, detail = '') =>
  results.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);

const config = (await (await fetch(`${CMS}/api/cms/config`)).json()) as { categoryMap: Record<string, string> };
const custom: { name: string; slug: string }[] = [];

type Case = { label: string; title: string; categories: string[]; expectDir: string };

const cases: Case[] = [
  // Reuses the configured 笔记 -> note
  { label: 'configured category', title: `检查-命中-${stamp}`, categories: ['笔记'], expectDir: 'note' },
  // A name the config does not know; server generates the slug itself
  {
    label: 'new category',
    title: `检查-新建-${stamp}`,
    categories: [`临时分类${stamp}`],
    expectDir: generateSlug(`临时分类${stamp}`),
  },
  // Two categories nest one level deeper
  { label: 'nested categories', title: `检查-嵌套-${stamp}`, categories: ['笔记', '随笔'], expectDir: 'note/life' },
  // No categories at all -> content root
  { label: 'no category', title: `检查-无分类-${stamp}`, categories: [], expectDir: '' },
];

const created: string[] = [];

try {
  for (const c of cases) {
    const preview = previewCategoryPath(c.categories, config.categoryMap, custom, generateSlug);
    const previewPath = preview.segments.join('/');

    const res = await fetch(`${CMS}/api/cms/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: c.title, categories: c.categories.length ? c.categories : undefined, draft: true }),
    });
    const body = (await res.json()) as { postId?: string; error?: string };
    if (!res.ok || !body.postId) {
      check(c.label, false, `create failed: ${body.error ?? res.status}`);
      continue;
    }
    created.push(body.postId);

    const actualDir = path.dirname(body.postId) === '.' ? '' : path.dirname(body.postId);
    check(`${c.label}: preview matches disk`, previewPath === actualDir, `preview="${previewPath}" disk="${actualDir}"`);

    const onDisk = await fs
      .access(path.join(CONTENT, body.postId))
      .then(() => true)
      .catch(() => false);
    check(`${c.label}: file exists`, onDisk, body.postId);
  }

  // The reuse case is the one the whole feature is about: prove the frontmatter
  // carries the display name, not the slug.
  const hit = created.find((p) => path.dirname(p) === 'note');
  if (hit) {
    const text = await fs.readFile(path.join(CONTENT, hit), 'utf-8');
    check('frontmatter keeps the display name', /-\s*\[笔记\]/.test(text), text.split('\n').slice(0, 8).join(' / '));
  } else {
    check('frontmatter keeps the display name', false, `no note/ post among: ${created.join(', ')}`);
  }

  // A typo near a configured name must be reported as new, not as a match.
  check('typo is reported as new', resolveCategory('week', config.categoryMap, custom)?.kind === 'new', 'week vs 周刊');
} finally {
  for (const p of created) {
    await fs.rm(path.join(CONTENT, p), { force: true });
    const dir = path.dirname(path.join(CONTENT, p));
    // Only remove the directory if we left it empty.
    await fs.rmdir(dir).catch(() => {});
  }
  // Clean up the temp category directory if it is now empty.
  for (const c of cases) {
    if (!c.expectDir) continue;
    await fs.rmdir(path.join(CONTENT, c.expectDir)).catch(() => {});
  }
}

console.log(results.join('\n'));
const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - failed}/${results.length} passed`);

const leftover = (await fs.readdir(CONTENT, { recursive: true })).filter((f) => String(f).includes(stamp));
console.log(`leftover scratch files: ${leftover.length === 0 ? 'none' : leftover.join(', ')}`);

process.exit(failed === 0 ? 0 : 1);
