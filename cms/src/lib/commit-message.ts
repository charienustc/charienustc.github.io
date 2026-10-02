/**
 * Commit Message Helpers
 *
 * Pure functions behind the one-click publish dialog. Kept separate from
 * `git.ts` so they can be unit-tested without a repository or a git binary.
 *
 * This module is imported by the BROWSER (the publish dialog uses it to build
 * and validate the subject), so it must stay free of Node builtins. In
 * particular it must not import from `git.ts`, which pulls in
 * `node:child_process` — Vite externalises that and the app fails to mount.
 * `MAX_SUBJECT_LENGTH` is therefore declared here and `git.ts` imports it.
 */

/**
 * Cap on a commit subject, matching how the git CLI is normally driven.
 *
 * Lives here rather than in `git.ts` so the client can share it without
 * importing a module that depends on Node builtins.
 */
export const MAX_SUBJECT_LENGTH = 200;

/**
 * Conventional-commit types this repo already uses, most common first.
 *
 * The blog is content-first, so `content` leads: it is the type the upstream
 * theme's own history uses for post edits and the one a writer will pick most.
 */
export const COMMIT_TYPES = [
  { value: 'content', label: 'content — 文章内容' },
  { value: 'docs', label: 'docs — 文档 / 页面文案' },
  { value: 'feat', label: 'feat — 新功能' },
  { value: 'fix', label: 'fix — 修 bug' },
  { value: 'style', label: 'style — 样式 / 配色' },
  { value: 'chore', label: 'chore — 杂项 / 依赖' },
] as const;

export type CommitType = (typeof COMMIT_TYPES)[number]['value'];

/** Lowercase, hyphenated scope, e.g. `nav` or `404`. */
const SCOPE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Leading pattern of a conventional commit, e.g. `feat(nav): `. */
const PREFIX_PATTERN = /^[a-z]+(?:\([^)]*\))?:\s*/;

/**
 * Derive a commit subject from a post title.
 *
 * Used to pre-fill the dialog so the common case is one keystroke. Falls back to
 * a generic subject when the title is empty or would be emptied by the
 * conventional-commit prefix being stripped.
 */
export function defaultSubjectForTitle(title: string): string {
  const cleaned = title.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'content: 更新文章';

  // A title that is already a conventional commit is left alone, so pressing
  // publish twice does not produce `feat: feat: ...`.
  if (PREFIX_PATTERN.test(cleaned)) return cleaned.slice(0, MAX_SUBJECT_LENGTH);

  return `content: ${cleaned}`.slice(0, MAX_SUBJECT_LENGTH);
}

/**
 * Assemble a conventional-commit subject from its parts.
 *
 * Returns an error string rather than throwing so the caller can render it
 * inline, and so the same validation backs both the dialog and the API.
 */
export function buildSubject(type: string, scope: string, description: string): { subject: string } | { error: string } {
  const trimmedDescription = description.replace(/\s+/g, ' ').trim();
  if (!trimmedDescription) return { error: '提交说明不能为空' };

  const trimmedScope = scope.trim();
  if (trimmedScope && !SCOPE_PATTERN.test(trimmedScope)) {
    return { error: 'scope 只能用小写字母、数字和连字符，例如 nav、mobile、404' };
  }

  const subject = trimmedScope ? `${type}(${trimmedScope}): ${trimmedDescription}` : `${type}: ${trimmedDescription}`;

  if (subject.length > MAX_SUBJECT_LENGTH) {
    return { error: `提交信息不能超过 ${MAX_SUBJECT_LENGTH} 个字符` };
  }

  return { subject };
}

/** Replace characters an OS command prompt cannot render, so errors stay copy-pasteable. */
function escapeControlChars(text: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping control bytes is the point
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

/**
 * Condense lint output into the tail a user actually needs to see.
 *
 * `pnpm lint-staged` prints a header, then the failures, and the actionable part
 * is always at the end. Passing 40KB of Biome report into the dialog would help
 * nobody, so prefer the stderr text and fall back to stdout.
 */
export function summarizeCommandFailure(stderr: string, stdout: string): string {
  const source = stderr.trim() || stdout.trim();
  if (!source) return '命令失败，但没有输出任何错误信息';
  return escapeControlChars(source);
}
