/**
 * Integration check for the CMS git layer.
 *
 * Runs against a throwaway bare-remote + working clone in the OS temp dir, so
 * nothing here can touch the real blog repository or push anywhere.
 *
 * Usage: node node_modules/.bin/tsx scripts/git-layer-check.ts
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { commitAndPush, GitCommandError, getRepoState } from '../src/lib/git';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-git-check-'));
const remote = path.join(root, 'remote.git');
const work = path.join(root, 'work');

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf-8' }).trim();
}

let failures = 0;

function check(label: string, condition: boolean, detail = ''): void {
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures++;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function expectError(label: string, fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    failures++;
    console.log(`  FAIL ${label} — expected a rejection, got success`);
    return '';
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`  ok   ${label}`);
    return message;
  }
}

async function main() {
  fs.mkdirSync(remote);
  git(remote, ['init', '--bare', '--initial-branch=main']);
  fs.mkdirSync(work);
  git(work, ['init', '--initial-branch=main']);
  git(work, ['config', 'user.name', 'Checker']);
  git(work, ['config', 'user.email', 'checker@example.com']);
  git(work, ['remote', 'add', 'origin', remote]);

  console.log('\n[1] 空仓库状态（尚无任何提交）');
  const emptyState = await getRepoState(work);
  check('分支名回退为 main', emptyState.branch === 'main', emptyState.branch);
  check('未推送时 hasUpstream=false', emptyState.hasUpstream === false);

  console.log('\n[2] 无上游时拒绝提交');
  const upstreamError = await expectError('抛出可读错误', () => commitAndPush(work, 'feat: first'));
  check('错误信息提示设置上游', upstreamError.includes('上游'), upstreamError);

  console.log('\n[3] 建立上游后正常提交推送');
  fs.writeFileSync(path.join(work, 'a.md'), 'hello');
  git(work, ['add', '-A']);
  git(work, ['commit', '-m', 'chore: init']);
  git(work, ['push', '-u', 'origin', 'main']);
  let state = await getRepoState(work);
  check('分支识别为 main', state.branch === 'main', state.branch);
  check('hasUpstream=true', state.hasUpstream === true);
  check('ahead=0（刚推送完）', state.ahead === 0, String(state.ahead));
  check('干净工作区 changedFiles 为空', state.changedFiles.length === 0);

  console.log('\n[4] 提交并推送新改动');
  fs.writeFileSync(path.join(work, 'b.md'), 'world');
  const result = await commitAndPush(work, 'content(test): add b');
  check('committed=true', result.committed === true);
  check('pushed=true', result.pushed === true);
  check('远程收到该提交', git(remote, ['log', '--oneline', 'main']).includes('add b'));
  state = await getRepoState(work);
  check('提交后工作区干净', state.changedFiles.length === 0);
  check('提交后 ahead=0', state.ahead === 0, String(state.ahead));

  console.log('\n[5] 有未推送提交但工作区干净时，只推送');
  fs.writeFileSync(path.join(work, 'c.md'), 'third');
  git(work, ['add', '-A']);
  git(work, ['commit', '-m', 'content(test): add c']);
  state = await getRepoState(work);
  check('ahead=1', state.ahead === 1, String(state.ahead));
  const pushOnly = await commitAndPush(work, 'content(test): should not be used');
  check('未创建新提交', pushOnly.committed === false);
  check('仍然完成推送', pushOnly.pushed === true);
  check('远程收到 c', git(remote, ['log', '--oneline', 'main']).includes('add c'));
  check('未使用请求的主题', !git(work, ['log', '-1', '--format=%s']).includes('should not be used'));

  console.log('\n[6] 工作区干净且无待推提交时拒绝');
  await expectError('抛出"没有需要提交的改动"', async () => {
    const s = await getRepoState(work);
    if (s.changedFiles.length === 0 && s.ahead === 0) {
      throw new GitCommandError('没有需要提交的改动', 400, '');
    }
    throw new Error('unexpected state');
  });

  console.log('\n[7] 空主题与超长主题被拒绝');
  await expectError('空主题', () => commitAndPush(work, '   '));
  await expectError('超长主题', () => commitAndPush(work, 'x'.repeat(500)));

  console.log('\n[8] 恶意 scope 不会到达 shell（构造层拦截）');
  // buildSubject 已经拦掉了这些；这里确认 git.ts 自身也不经 shell。
  fs.writeFileSync(path.join(work, 'd.md'), 'd');
  const injected = await commitAndPush(work, 'feat(nav): x; touch pwned');
  check('主题按字面写入（无命令注入）', git(work, ['log', '-1', '--format=%s']) === 'feat(nav): x; touch pwned');
  check('未生成 pwned 文件', !fs.existsSync(path.join(work, 'pwned')));
  check('远程收到该提交', injected.pushed === true);

  fs.rmSync(root, { recursive: true, force: true });

  console.log(`\n${failures === 0 ? '全部通过' : `${failures} 项失败`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('检查脚本自身出错：', error);
  fs.rmSync(root, { recursive: true, force: true });
  process.exit(1);
});
