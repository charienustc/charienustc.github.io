/**
 * Integration check for delete retention.
 *
 * Drives the real CMS API against throwaway posts written into the content
 * directory, and asserts the file is retained rather than destroyed. Every post
 * this creates is removed again, and the retained copies it produces are deleted
 * from `backups/deleted/` on the way out, so the repository is left as found.
 *
 * Usage: pnpm exec tsx cms/scripts/delete-retention-check.ts
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const CMS = 'http://localhost:4322';
const ROOT = 'F:\\myhomepage';
const CONTENT = path.join(ROOT, 'src', 'content', 'blog');
const RETENTION = path.join(ROOT, 'backups', 'deleted');

const stamp = Date.now().toString(36);
const results: string[] = [];
const check = (name: string, pass: boolean, detail = '') =>
  results.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);

/** Paths this run created, so the finally block can take them all back out. */
const createdPosts: string[] = [];
const createdRetained: string[] = [];

const body = (title: string) =>
  `---\ntitle: ${title}\ndate: 2026-10-03 10:00:00\ncategories:\n  - [随笔]\ndraft: true\n---\n\n正文内容\n`;

async function writePost(rel: string, title: string): Promise<string> {
  const abs = path.join(CONTENT, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, body(title), 'utf-8');
  createdPosts.push(rel);
  return abs;
}

async function del(postId: string) {
  const res = await fetch(`${CMS}/api/cms/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ postId }),
  });
  return { status: res.status, body: (await res.json()) as { retainedPath?: string; error?: string } };
}

try {
  // 1. A plain delete retains the file and reports where it went.
  const rel = `retention-${stamp}/poem.md`;
  const abs = await writePost(rel, '保留测试');
  const original = await fs.readFile(abs, 'utf-8');

  const first = await del(rel);
  check('删除请求成功', first.status === 200, `status=${first.status} ${first.body.error ?? ''}`);
  check('响应带回可还原路径', typeof first.body.retainedPath === 'string', first.body.retainedPath ?? '(缺失)');

  const goneFromContent = await fs
    .access(abs)
    .then(() => false)
    .catch(() => true);
  check('原文件已移走', goneFromContent, rel);

  const retainedAbs = path.join(ROOT, first.body.retainedPath ?? '');
  if (first.body.retainedPath) createdRetained.push(retainedAbs);
  const retainedExists = await fs
    .access(retainedAbs)
    .then(() => true)
    .catch(() => false);
  check('副本存在于 backups/deleted', retainedExists, first.body.retainedPath ?? '');

  // 2. The copy is byte-identical — a retention that mangles content is no use.
  if (retainedExists) {
    const copy = await fs.readFile(retainedAbs, 'utf-8');
    check('副本内容与原文件逐字节相同', copy === original);
  }

  // 3. Directory structure is preserved.
  check(
    '保留了原目录层级',
    (first.body.retainedPath ?? '').includes(`${path.sep}retention-${stamp}${path.sep}`),
    first.body.retainedPath ?? '',
  );
  check('文件名带 .deleted 后缀', (first.body.retainedPath ?? '').endsWith('.deleted'));

  // 4. Deleting the same path twice keeps BOTH copies.
  const rel2 = `retention-${stamp}/twice.md`;
  await writePost(rel2, '二次删除');
  const a = await del(rel2);
  if (a.body.retainedPath) createdRetained.push(path.join(ROOT, a.body.retainedPath));
  await new Promise((r) => setTimeout(r, 5)); // guarantee a different ms stamp
  await writePost(rel2, '二次删除');
  const b = await del(rel2);
  if (b.body.retainedPath) createdRetained.push(path.join(ROOT, b.body.retainedPath));

  check(
    '两次删除得到不同的保留路径',
    a.body.retainedPath !== b.body.retainedPath,
    `${a.body.retainedPath} vs ${b.body.retainedPath}`,
  );
  const bothExist = await Promise.all(
    [a, b].map((r) =>
      fs
        .access(path.join(ROOT, r.body.retainedPath ?? 'x'))
        .then(() => true)
        .catch(() => false),
    ),
  );
  check('两个副本同时保留，未互相覆盖', bothExist.every(Boolean));

  // 5. Path traversal is refused, on both the source and destination side.
  for (const bad of ['../../etc/passwd.md', 'sub/../../../outside.md', '..']) {
    const res = await del(bad);
    check(`拒绝路径逃逸: ${bad}`, res.status === 400, `status=${res.status}`);
  }

  // 6. A missing file reports 404 rather than pretending success.
  const missing = await del(`retention-${stamp}/never-existed.md`);
  check('不存在的文件返回 404', missing.status === 404, `status=${missing.status}`);
} catch (error) {
  check('检查过程未抛异常', false, error instanceof Error ? error.message : String(error));
} finally {
  for (const rel of createdPosts) {
    await fs.rm(path.join(CONTENT, rel), { force: true });
  }
  // Remove the scratch category directory if empty.
  await fs.rmdir(path.join(CONTENT, `retention-${stamp}`)).catch(() => {});
  for (const abs of createdRetained) {
    await fs.rm(abs, { force: true });
    await fs.rmdir(path.dirname(abs)).catch(() => {});
  }
  await fs.rmdir(path.join(RETENTION, `retention-${stamp}`)).catch(() => {});
}

console.log(results.join('\n'));
const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - failed}/${results.length} passed`);

// Confirm the run left nothing behind.
const leftovers = (await fs.readdir(CONTENT, { recursive: true }).catch(() => [])).filter((f) =>
  String(f).includes(`retention-${stamp}`),
);
console.log(`残留文件: ${leftovers.length === 0 ? '无' : leftovers.join(', ')}`);

process.exit(failed === 0 ? 0 : 1);
