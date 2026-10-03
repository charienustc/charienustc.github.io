/**
 * Integration check for moment editing.
 *
 * Drives the real CMS API against throwaway moments and asserts the properties
 * that matter: the body is rewritten, `date` survives untouched, `updated` is
 * set, the previous revision is retained byte-identically, and a traversal id
 * cannot write outside the content directory.
 *
 * Everything this creates is removed again on the way out.
 *
 * Usage: pnpm exec tsx cms/scripts/moment-edit-check.ts
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const CMS = 'http://localhost:4322';
const ROOT = 'F:\\myhomepage';
const MOMENTS = path.join(ROOT, 'src', 'content', 'moments');
const VERSIONS = path.join(ROOT, 'backups', 'versions');
const RETENTION = path.join(ROOT, 'backups', 'deleted');

const stamp = Date.now().toString(36);
const results: string[] = [];
const check = (name: string, pass: boolean, detail = '') =>
  results.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);

const created: string[] = [];
const versionFiles: string[] = [];

const post = async (url: string, payload: unknown) => {
  const res = await fetch(`${CMS}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
};

try {
  // 1. Create a moment to edit.
  const make = await post('/api/cms/moments', { body: `原始内容${stamp}`, date: '2026-08-01 10:00:00' });
  const momentId = make.body.momentId as string;
  check('创建成功', make.status === 201 && Boolean(momentId), String(momentId));
  created.push(path.join(MOMENTS, momentId));

  const originalPath = path.join(MOMENTS, momentId);
  const originalRaw = await fs.readFile(originalPath, 'utf-8');
  check('新建时未写入 updated', !originalRaw.includes('updated:'), '');

  // 2. Edit it.
  const edit = await post('/api/cms/moments/update', {
    momentId,
    body: `改过的内容${stamp}`,
    tags: ['测试'],
  });
  check('更新请求成功', edit.status === 200, `status=${edit.status} ${edit.body.error ?? ''}`);
  check('响应带回旧版路径', typeof edit.body.versionPath === 'string', String(edit.body.versionPath ?? '(缺失)'));

  const afterRaw = await fs.readFile(originalPath, 'utf-8');
  check('正文已改写', afterRaw.includes(`改过的内容${stamp}`), '');
  check('旧正文已不存在', !afterRaw.includes(`原始内容${stamp}`), '');
  check('标签已写入', afterRaw.includes('测试'), '');

  // 3. `date` must survive untouched — it drives feed ordering.
  check('发布日期保持不变', afterRaw.includes('date: 2026-08-01 10:00:00'), '');

  // 4. `updated` must now be present and differ from date.
  const updatedLine = afterRaw.match(/^updated:\s*(.+)$/m)?.[1]?.trim();
  check('写入了 updated', Boolean(updatedLine), String(updatedLine ?? '(缺失)'));
  check('updated 与 date 不同', updatedLine !== '2026-08-01 10:00:00', String(updatedLine));

  // 5. The previous revision is retained byte-identically.
  const versionAbs = path.join(ROOT, String(edit.body.versionPath ?? ''));
  versionFiles.push(versionAbs);
  const versionRaw = await fs.readFile(versionAbs, 'utf-8').catch(() => '');
  check('旧版副本存在', versionRaw.length > 0, String(edit.body.versionPath ?? ''));
  check('旧版逐字节相同', versionRaw === originalRaw, '');
  check('旧版放在 backups/versions', String(edit.body.versionPath).includes('versions'), String(edit.body.versionPath));
  check('未混入 deleted 目录', !String(edit.body.versionPath).includes('deleted'), '');

  // 6. Editing twice keeps both revisions and does not reset `updated` backwards.
  await new Promise((r) => setTimeout(r, 5));
  const second = await post('/api/cms/moments/update', { momentId, body: `第三次内容${stamp}` });
  check('二次编辑成功', second.status === 200, `status=${second.status}`);
  if (second.body.versionPath) versionFiles.push(path.join(ROOT, String(second.body.versionPath)));
  check(
    '两次编辑得到不同的旧版路径',
    edit.body.versionPath !== second.body.versionPath,
    `${edit.body.versionPath} vs ${second.body.versionPath}`,
  );

  const bothExist = await Promise.all(
    versionFiles.map((f) =>
      fs
        .access(f)
        .then(() => true)
        .catch(() => false),
    ),
  );
  check('两个旧版同时保留', bothExist.every(Boolean));

  // 7. Path traversal must be refused on the write path.
  for (const bad of ['../../etc/passwd.md', 'sub/../../../outside.md', '..', 'a.txt']) {
    const res = await post('/api/cms/moments/update', { momentId: bad, body: 'x' });
    check(`拒绝路径逃逸: ${bad}`, res.status === 400, `status=${res.status}`);
  }

  // 8. A missing moment is a 404, not a silent create.
  const missing = await post('/api/cms/moments/update', { momentId: `never-${stamp}.md`, body: 'x' });
  check('不存在的碎碎念返回 404', missing.status === 404, `status=${missing.status}`);

  // 9. Editing must not leave a stray file where the traversal was aimed.
  const escaped = await fs
    .access(path.join(ROOT, '..', 'etc', 'passwd.md'))
    .then(() => true)
    .catch(() => false);
  check('未在内容目录外写入文件', !escaped);

  // 10. Empty body is rejected.
  const empty = await post('/api/cms/moments/update', { momentId, body: '   ' });
  check('拒绝空正文', empty.status === 400, `status=${empty.status}`);
} catch (error) {
  check('检查过程未抛异常', false, error instanceof Error ? error.message : String(error));
} finally {
  for (const f of created) await fs.rm(f, { force: true });
  for (const f of versionFiles) await fs.rm(f, { force: true });
}

console.log(results.join('\n'));
const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - failed}/${results.length} passed`);

const leftovers = (await fs.readdir(MOMENTS).catch(() => [])).filter((f) => f.includes(stamp));
const versionLeftovers = (await fs.readdir(VERSIONS, { recursive: true }).catch(() => [])).filter((f) =>
  String(f).includes(stamp),
);
const deletedLeftovers = (await fs.readdir(RETENTION, { recursive: true }).catch(() => [])).filter((f) =>
  String(f).includes(stamp),
);
console.log(`残留: moments=${leftovers.length} versions=${versionLeftovers.length} deleted=${deletedLeftovers.length}`);

process.exit(failed === 0 ? 0 : 1);
