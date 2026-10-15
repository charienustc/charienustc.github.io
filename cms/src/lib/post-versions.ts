import type { Dirent } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { PostVersionItem } from '../types';
import { CONTENT_DIR, MOMENT_VERSIONS_DIR } from './paths';
import { versionTimestamp } from './versions';

export const POST_VERSIONS_DIR = `${MOMENT_VERSIONS_DIR}/posts`;
const STAMP = /\.(\d{8}-\d{9})\.md$/;

export class VersionError extends Error {
  constructor(
    message: string,
    public status: 400 | 404 | 409 = 400,
  ) {
    super(message);
  }
}

function normalizeId(id: string): string {
  const normalized = id.replace(/\\/g, '/');
  if (
    !normalized ||
    normalized.includes('\0') ||
    normalized.includes(':') ||
    path.posix.isAbsolute(normalized) ||
    normalized.split('/').some((part) => !part || part === '.' || part === '..') ||
    !/\.mdx?$/.test(normalized)
  ) {
    throw new VersionError('Invalid postId');
  }
  return normalized;
}

/** Reject symlinks in every existing path segment, including backup roots. */
export async function checkedPostPath(projectRoot: string, relative: string): Promise<string> {
  const root = await fs.realpath(projectRoot);
  const target = path.resolve(root, relative);
  const within = path.relative(root, target);
  if (!within || within.startsWith('..') || path.isAbsolute(within)) throw new VersionError('Invalid path');
  let current = root;
  for (const part of within.split(path.sep)) {
    current = path.join(current, part);
    try {
      if ((await fs.lstat(current)).isSymbolicLink()) throw new VersionError('Symbolic links are not supported');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  return target;
}

export async function resolvePostPath(projectRoot: string, postId: string): Promise<string> {
  return checkedPostPath(projectRoot, `${CONTENT_DIR}/${normalizeId(postId)}`);
}

function versionId(postId: string, version: string): string {
  const id = normalizeId(postId);
  const normalized = version.replace(/\\/g, '/');
  if (!normalized.startsWith(id) || !/^\.\d{8}-\d{9}\.md$/.test(normalized.slice(id.length))) {
    throw new VersionError('Version does not belong to this post');
  }
  return normalized;
}

function savedAt(version: string): string {
  const stamp = STAMP.exec(version)?.[1] ?? '';
  return `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)} ${stamp.slice(9, 11)}:${stamp.slice(11, 13)}:${stamp.slice(13, 15)}.${stamp.slice(15)}`;
}

/** Exclusive creation keeps even simultaneous saves from overwriting a backup. */
export async function retainPostVersion(
  projectRoot: string,
  postId: string,
  content: string,
  now = new Date(),
): Promise<string> {
  const id = normalizeId(postId);
  for (let offset = 0; offset < 1000; offset++) {
    const version = `${id}.${versionTimestamp(new Date(now.getTime() + offset))}.md`;
    const relative = `${POST_VERSIONS_DIR}/${version}`;
    let destination = await checkedPostPath(projectRoot, relative);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    destination = await checkedPostPath(projectRoot, relative);
    try {
      await fs.writeFile(destination, content, { encoding: 'utf-8', flag: 'wx' });
      return version;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
  }
  throw new VersionError('Too many concurrent saves; please retry', 409);
}

export async function listPostVersions(projectRoot: string, postId: string): Promise<PostVersionItem[]> {
  const id = normalizeId(postId);
  const directory = await checkedPostPath(projectRoot, path.posix.dirname(`${POST_VERSIONS_DIR}/${id}`));
  let entries: Dirent[];
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const items: PostVersionItem[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const version = path.posix.join(path.posix.dirname(id), entry.name);
    try {
      versionId(id, version);
    } catch {
      continue;
    }
    const destination = await checkedPostPath(projectRoot, `${POST_VERSIONS_DIR}/${version}`);
    items.push({ version, savedAt: savedAt(version), size: (await fs.stat(destination)).size });
  }
  return items.sort((a, b) => b.version.localeCompare(a.version));
}

export async function readPostVersion(projectRoot: string, postId: string, version: string) {
  const id = versionId(postId, version);
  const source = await checkedPostPath(projectRoot, `${POST_VERSIONS_DIR}/${id}`);
  return { content: await fs.readFile(source, 'utf-8'), version: id, savedAt: savedAt(id) };
}

export async function restorePostVersion(projectRoot: string, postId: string, version: string): Promise<void> {
  const revision = await readPostVersion(projectRoot, postId, version);
  const destination = await resolvePostPath(projectRoot, postId);
  // Never silently recreate a deleted post.
  const previous = await fs.readFile(destination, 'utf-8');
  await retainPostVersion(projectRoot, postId, previous);
  await fs.writeFile(destination, revision.content, 'utf-8');
}
