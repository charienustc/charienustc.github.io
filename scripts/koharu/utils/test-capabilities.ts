/**
 * Platform capability probes for the koharu CLI tests.
 *
 * Several tests in this directory assert POSIX behaviour — file modes, symlink
 * handling — that Windows cannot express. Those assertions are still worth
 * keeping: they guard real security properties (an archive is private, a
 * symlink is not followed) and they do run on Linux CI. What they must not do
 * is fail on a platform where the underlying call is a no-op, because a red
 * test that cannot pass is a test people learn to ignore.
 *
 * Skipping is decided by probing the actual capability, never by checking
 * `process.platform`. A Windows machine with Developer Mode enabled can create
 * symlinks, and that machine should run the symlink tests.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Whether `fs.chmod` has any effect on this filesystem.
 *
 * Probes a real file rather than trusting the platform name: chmod is a silent
 * no-op on Windows, where `statSync().mode` reports 0o666 regardless of what
 * was requested.
 */
export function canSetFileMode(): boolean {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'koharu-cap-mode-'));
  const probe = path.join(dir, 'probe');
  try {
    fs.writeFileSync(probe, '');
    fs.chmodSync(probe, 0o600);
    return (fs.statSync(probe).mode & 0o777) === 0o600;
  } catch {
    return false;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Whether this process can create symbolic links.
 *
 * Windows requires either elevation or Developer Mode; without one, `fs.symlink`
 * throws EPERM. Probes with a real link rather than assuming, so the tests run
 * wherever they genuinely can.
 */
export function canCreateSymlinks(): boolean {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'koharu-cap-link-'));
  try {
    fs.writeFileSync(path.join(dir, 'target'), '');
    fs.symlinkSync(path.join(dir, 'target'), path.join(dir, 'link'));
    return true;
  } catch {
    return false;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Reasons reported when a capability-dependent test is skipped.
 *
 * Kept as constants so every skip prints the same wording, and so a reader of
 * the output learns why rather than seeing a bare "skipped".
 */
export const SKIP_REASON = {
  fileMode: '此平台不支持 POSIX 文件权限（chmod 无效），仅在 Linux/macOS 上验证',
  symlink: '此进程无法创建符号链接（Windows 需管理员权限或开发者模式），仅在具备该能力时验证',
} as const;
