import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { Hono } from 'hono';
import { listVersionsHandler, readVersionHandler, restoreVersionHandler } from '../api/versions';
import { CONTENT_DIR, MOMENT_VERSIONS_DIR } from './paths';
import { listPostVersions, POST_VERSIONS_DIR, readPostVersion, restorePostVersion, retainPostVersion } from './post-versions';

async function fixture(t: { after: (callback: () => Promise<void>) => void }) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cms-post-history-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const post = path.join(root, CONTENT_DIR, 'note/a.md');
  await fs.mkdir(path.dirname(post), { recursive: true });
  await fs.writeFile(post, '---\ntitle: Current\n---\nCurrent body');
  return { root, post };
}

test('versions are isolated from moments, filtered by post, and sorted newest first', async (t) => {
  const { root } = await fixture(t);
  assert.deepEqual(await listPostVersions(root, 'note/a.md'), []);
  const at = new Date(2026, 9, 15, 10, 0, 0, 123);
  const first = await retainPostVersion(root, 'note/a.md', '旧版中文', at);
  const second = await retainPostVersion(root, 'note/a.md', 'newer', new Date(at.getTime() + 1));
  await retainPostVersion(root, 'note/a.mdx', 'different extension', at);
  await fs.writeFile(path.join(root, MOMENT_VERSIONS_DIR, 'a.md.20261015-100000123.md'), 'moment');
  const versions = await listPostVersions(root, 'note\\a.md');
  assert.deepEqual(
    versions.map((item) => item.version),
    [second, first],
  );
  assert.equal(versions[1]?.size, Buffer.byteLength('旧版中文'));
  assert.equal(versions[1]?.savedAt, '2026-10-15 10:00:00.123');
  assert.equal((await readPostVersion(root, 'note/a.md', first)).content, '旧版中文');
});

test('simultaneous same-millisecond backups retain every revision', async (t) => {
  const { root } = await fixture(t);
  const now = new Date(2026, 9, 15);
  const versions = await Promise.all(['one', 'two', 'three'].map((body) => retainPostVersion(root, 'note/a.md', body, now)));
  assert.equal(new Set(versions).size, 3);
  const contents = await Promise.all(
    versions.map(async (version) => (await readPostVersion(root, 'note/a.md', version)).content),
  );
  assert.deepEqual(contents, ['one', 'two', 'three']);
});

test('restoration preserves exact markdown and retains the current state for undo', async (t) => {
  const { root, post } = await fixture(t);
  const current = await fs.readFile(post, 'utf-8');
  const original = '---\r\ntitle: Old\r\ndraft: true\r\n---\r\n旧正文\r\n';
  const version = await retainPostVersion(root, 'note/a.md', original);
  await restorePostVersion(root, 'note/a.md', version);
  assert.equal(await fs.readFile(post, 'utf-8'), original);
  const undo = (await listPostVersions(root, 'note/a.md')).find((item) => item.version !== version);
  assert.ok(undo);
  assert.equal((await readPostVersion(root, 'note/a.md', undo.version)).content, current);
  await restorePostVersion(root, 'note/a.md', undo.version);
  assert.equal(await fs.readFile(post, 'utf-8'), current);
});

test('invalid ids and cross-post restore attempts cannot overwrite content', async (t) => {
  const { root, post } = await fixture(t);
  const current = await fs.readFile(post, 'utf-8');
  const version = await retainPostVersion(root, 'other.md', 'other post');
  await assert.rejects(restorePostVersion(root, 'note/a.md', version), /does not belong/);
  for (const id of ['../a.md', 'sub/../../a.md', '/a.md', 'C:\\a.md', '..\\a.md', 'a\0.md', '']) {
    await assert.rejects(listPostVersions(root, id));
    await assert.rejects(retainPostVersion(root, id, 'bad'));
  }
  assert.equal(await fs.readFile(post, 'utf-8'), current);
});

test('backup failure leaves current content unchanged', async (t) => {
  const { root, post } = await fixture(t);
  const version = await retainPostVersion(root, 'note/a.md', 'old');
  const current = await fs.readFile(post, 'utf-8');
  const write = fs.writeFile;
  t.mock.method(fs, 'writeFile', async (...args: Parameters<typeof fs.writeFile>) => {
    if (String(args[0]).startsWith(path.join(root, POST_VERSIONS_DIR))) throw new Error('Disk full');
    return write(...args);
  });
  await assert.rejects(restorePostVersion(root, 'note/a.md', version), /Disk full/);
  assert.equal(await fs.readFile(post, 'utf-8'), current);
});

test('history endpoints validate requests and return list, read and restore results', async (t) => {
  const { root, post } = await fixture(t);
  const app = new Hono<{ Variables: { projectRoot: string } }>();
  app.use('*', async (c, next) => {
    c.set('projectRoot', root);
    await next();
  });
  app.get('/versions', listVersionsHandler);
  app.get('/read', readVersionHandler);
  app.post('/restore', restoreVersionHandler);
  assert.equal((await app.request('/versions?postId=../bad.md')).status, 400);
  const version = await retainPostVersion(root, 'note/a.md', 'restored');
  const query = new URLSearchParams({ postId: 'note/a.md', version });
  const listing = await app.request('/versions?postId=note/a.md');
  assert.equal(listing.status, 200);
  assert.equal((await listing.json()).versions.length, 1);
  assert.equal((await (await app.request(`/read?${query}`)).json()).content, 'restored');
  const request = (body: string) =>
    app.request('/restore', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  assert.equal((await request('{')).status, 400);
  assert.equal((await request('{}')).status, 400);
  assert.equal((await request(JSON.stringify({ postId: 'other.md', version }))).status, 400);
  assert.equal((await request(JSON.stringify({ postId: 'note/a.md', version }))).status, 200);
  assert.equal(await fs.readFile(post, 'utf-8'), 'restored');
  assert.equal((await app.request('/read?postId=note/a.md&version=note/a.md.20000101-000000000.md')).status, 404);
});

test('symlinked backup and content directories are rejected when supported', async (t) => {
  const { root, post } = await fixture(t);
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'cms-history-outside-'));
  t.after(() => fs.rm(outside, { recursive: true, force: true }));
  const link = path.join(root, 'backups');
  try {
    await fs.symlink(outside, link, 'junction');
  } catch (error) {
    if (['EPERM', 'EACCES'].includes((error as NodeJS.ErrnoException).code ?? '')) {
      t.skip('Symlinks unavailable');
      return;
    }
    throw error;
  }
  await assert.rejects(retainPostVersion(root, 'note/a.md', 'bad'), /Symbolic links/);
  assert.deepEqual(await fs.readdir(outside), []);
  await fs.unlink(link);
  await fs.unlink(post);
  try {
    await fs.symlink(path.join(outside, 'a.md'), post);
  } catch (error) {
    if (['EPERM', 'EACCES'].includes((error as NodeJS.ErrnoException).code ?? '')) {
      t.skip('File symlinks unavailable');
      return;
    }
    throw error;
  }
  const version = await retainPostVersion(root, 'note/a.md', 'bad');
  await assert.rejects(restorePostVersion(root, 'note/a.md', version), /Symbolic links/);
});
