import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { PROJECT_ROOT } from '../constants';

/**
 * Run tar with the platform's required flags.
 *
 * `--force-local` is added on Windows only. GNU tar parses `C:\path` as an
 * rsync-style `host:path` and fails with "Cannot connect to C: resolve failed",
 * so every archive path here — all absolute — is unusable without it. On POSIX
 * the flag is accepted but meaningless, and adding it unconditionally would
 * mean shipping a Windows workaround into the Linux path; it is also absent
 * from BSD tar, which would break macOS.
 *
 * Every tar invocation goes through here so the flag cannot be forgotten at one
 * call site and silently reintroduce the failure.
 *
 * @param args - tar arguments, without the leading flags
 * @param options - spawn options; `cwd` replaces any directory the command
 *   would otherwise name with `-C` (see below)
 * @returns The spawnSync result
 */
function runTar(args: string[], options: { encoding?: BufferEncoding; stdio?: 'pipe'; cwd?: string } = {}) {
  const platformFlags = process.platform === 'win32' ? ['--force-local'] : [];
  return spawnSync('tar', [...platformFlags, ...args], {
    cwd: PROJECT_ROOT,
    ...options,
  });
}

/**
 * Point tar at a directory by changing into it rather than with `-C`.
 *
 * On Windows, GNU tar 1.35 mangles an absolute `-C` path: it partially doubles
 * the backslashes and then reports `Cannot open: No such file or directory` for
 * a directory that demonstrably exists. The failure is silent from the caller's
 * side — a create or extract just returns a non-zero status — so it reads as a
 * corrupt archive rather than a path problem.
 *
 * Passing the directory as the child's working directory avoids tar's
 * path-rewriting entirely, and behaves the same on POSIX. Verified against the
 * same archive: `-C` fails, `cwd` succeeds.
 *
 * @param dir - Directory tar should treat as its working directory
 * @param args - Remaining tar arguments
 * @param options - Extra spawn options
 * @returns The spawnSync result
 */
function runTarIn(dir: string, args: string[], options: { encoding?: BufferEncoding; stdio?: 'pipe' } = {}) {
  return runTar(args, { ...options, cwd: dir });
}

function validateTarEntries(entries: string[], archivePath: string): void {
  for (const entry of entries) {
    if (!entry) {
      continue;
    }

    if (entry.includes('\0')) {
      throw new Error(`tar entry contains null byte in ${archivePath}`);
    }

    const normalized = path.posix.normalize(entry);
    if (normalized === '.' || normalized === '') {
      continue;
    }

    if (path.posix.isAbsolute(normalized)) {
      throw new Error(`tar entry is absolute path: ${entry}`);
    }

    const parts = normalized.split('/');
    if (parts.includes('..')) {
      throw new Error(`tar entry contains parent traversal: ${entry}`);
    }
  }
}

function validateTarEntryTypes(archivePath: string, entryCount: number): void {
  const result = runTar(['-tvzf', archivePath], { encoding: 'utf-8' });
  if (result.status !== 0) {
    throw new Error(`tar verbose list failed: ${result.stderr?.toString() || 'unknown error'}`);
  }

  const lines = result.stdout.split('\n').filter(Boolean);
  if (lines.length !== entryCount) {
    throw new Error(`tar verbose listing is inconsistent: ${archivePath}`);
  }

  for (const line of lines) {
    const entryType = line[0];
    if (entryType !== '-' && entryType !== 'd') {
      throw new Error(`tar entry has unsupported type "${entryType || 'unknown'}": ${archivePath}`);
    }
  }
}

function listTarEntries(archivePath: string): string[] {
  const result = runTar(['-tzf', archivePath], { encoding: 'utf-8' });
  if (result.status !== 0) {
    throw new Error(`tar list failed: ${result.stderr?.toString() || 'unknown error'}`);
  }
  const entries = result.stdout.split('\n').filter(Boolean);
  validateTarEntries(entries, archivePath);
  validateTarEntryTypes(archivePath, entries.length);
  return entries;
}

/**
 * 从 tar.gz 中提取 manifest.json 内容（不解压整个文件）
 */
export function tarExtractManifest(archivePath: string): string | null {
  // Archives are created with `-C <dir> .`, so entries are stored as
  // `./manifest.json`. Asking for the bare name only works on GNU tar builds
  // that leniently match the leading `./`; others report "Not found in archive"
  // and the manifest silently disappears. Try the path as actually stored
  // first, and keep the bare form as a fallback for archives made elsewhere.
  for (const entry of ['./manifest.json', 'manifest.json']) {
    const result = runTar(['-xzf', archivePath, '-O', entry], {
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    if (result.status === 0 && result.stdout) {
      return result.stdout;
    }
  }
  return null;
}

/**
 * 列出 tar.gz 归档内容
 */
export function tarList(archivePath: string): string[] {
  return listTarEntries(archivePath);
}

/**
 * 创建 tar.gz 归档
 */
export function tarCreate(archivePath: string, sourceDir: string): void {
  const archiveHandle = fs.openSync(archivePath, 'wx', 0o600);
  fs.closeSync(archiveHandle);
  fs.chmodSync(archivePath, 0o600);

  // The source directory goes through cwd rather than -C: see runTarIn.
  const result = runTarIn(sourceDir, ['-czf', archivePath, '.']);
  if (result.status !== 0) {
    fs.rmSync(archivePath, { force: true });
    throw new Error(`tar create failed: ${result.stderr?.toString() || 'unknown error'}`);
  }
  fs.chmodSync(archivePath, 0o600);
}

/**
 * 解压 tar.gz 归档到指定目录
 */
export function tarExtract(archivePath: string, destDir: string): void {
  listTarEntries(archivePath);
  // The destination goes through cwd rather than -C: see runTarIn.
  const result = runTarIn(destDir, ['-xzf', archivePath]);
  if (result.status !== 0) {
    throw new Error(`tar extract failed: ${result.stderr?.toString() || 'unknown error'}`);
  }
}
