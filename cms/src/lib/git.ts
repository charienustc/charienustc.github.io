/**
 * CMS Git Utilities
 *
 * Runs the git commands behind the one-click commit-and-push flow.
 *
 * The CMS edits files on disk; publishing them is a git operation on the blog
 * repository, which lives one level above the CMS. `PROJECT_ROOT` is passed in
 * from the request context rather than imported, so this module stays free of
 * any assumption about where the CMS itself is installed.
 *
 * Every git invocation uses `execFile` with an argument array — never a shell
 * string. A commit subject is free-form user input and would otherwise reach
 * the shell, where backticks, `$()` and quotes are all live.
 */

import { execFile } from 'node:child_process';

import { MAX_SUBJECT_LENGTH } from './commit-message';

/** Longest we wait for a single git command before giving up. */
const GIT_TIMEOUT_MS = 30_000;

/**
 * Cap on captured stderr. A failing `pnpm lint-staged` can emit thousands of
 * lines; the dialog only renders a fixed-height box, so keep the tail and drop
 * the rest rather than shipping megabytes through JSON.
 */
const MAX_STDERR_LENGTH = 8_000;

/** Cap on captured stdout, for the diffstat summary. */
const MAX_STDOUT_LENGTH = 8_000;

export interface GitResult {
  stdout: string;
  stderr: string;
  status: number;
}

export class GitCommandError extends Error {
  readonly status: number;
  readonly stderr: string;

  constructor(message: string, status: number, stderr: string) {
    super(message);
    this.name = 'GitCommandError';
    this.status = status;
    this.stderr = stderr;
  }
}

/** Trim to the last `max` characters, marking that earlier output was dropped. */
function tail(text: string, max: number): string {
  if (text.length <= max) return text;
  return `…（前 ${text.length - max} 字符已省略）\n${text.slice(-max)}`;
}

/**
 * Run a git command in the project root.
 *
 * `execFile` rejects on a non-zero exit; the rejection carries stderr, which is
 * where git puts both its progress and its errors. Both streams are captured so
 * callers can show the user something actionable.
 */
function runGit(projectRoot: string, args: string[]): Promise<GitResult> {
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      args,
      { cwd: projectRoot, timeout: GIT_TIMEOUT_MS, windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          const status = typeof error.code === 'number' ? error.code : 1;
          reject(new GitCommandError(error.message, status, tail(stderr, MAX_STDERR_LENGTH)));
          return;
        }
        resolve({
          stdout: tail(stdout, MAX_STDOUT_LENGTH),
          stderr: tail(stderr, MAX_STDERR_LENGTH),
          status: 0,
        });
      },
    );
  });
}

/**
 * Environment variables that make git non-interactive.
 *
 * Without these a missing credential, an unknown host key or an expired token
 * makes git block on a hidden terminal prompt, and the request just hangs until
 * the timeout. Failing fast with a readable message is far more useful.
 */
const NON_INTERACTIVE_ENV: Record<string, string> = {
  GIT_TERMINAL_PROMPT: '0',
  GIT_ASKPASS: 'echo',
  SSH_ASKPASS: 'echo',
};

/** Run a git command with prompts disabled. */
function run(projectRoot: string, args: string[]): Promise<GitResult> {
  const previous = {
    GIT_TERMINAL_PROMPT: process.env.GIT_TERMINAL_PROMPT,
    GIT_ASKPASS: process.env.GIT_ASKPASS,
    SSH_ASKPASS: process.env.SSH_ASKPASS,
  };
  Object.assign(process.env, NON_INTERACTIVE_ENV);
  return runGit(projectRoot, args).finally(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

/**
 * Run a git command, resolving with the exit status instead of rejecting.
 *
 * Needed for the `--quiet` family, where a non-zero exit is a *result* rather
 * than a failure: `git diff --quiet` exits 1 to mean "there is a difference".
 * `run()` rejects on that, so these callers need the status itself.
 */
function runAllowFailure(projectRoot: string, args: string[]): Promise<GitResult> {
  return run(projectRoot, args).catch((error: unknown) => {
    if (error instanceof GitCommandError) {
      return { stdout: '', stderr: error.stderr, status: error.status };
    }
    throw error;
  });
}

export interface RepoState {
  /** Current branch name, or a detached-HEAD description. */
  branch: string;
  /** Whether the branch has an upstream to push to. */
  hasUpstream: boolean;
  /** Files reported by `git status --porcelain`. */
  changedFiles: string[];
  /** Commits present locally but not on the upstream. */
  ahead: number;
}

/** Stage the whole working tree, including deletions. */
export async function stageAll(projectRoot: string): Promise<void> {
  await run(projectRoot, ['add', '-A']);
}

/**
 * Unstage everything, leaving the working tree untouched.
 *
 * `git reset` with no revision is the "unstage all" form. It is safe on a
 * repository with an unborn HEAD, which a plain `git reset HEAD` is not.
 */
export async function unstageAll(projectRoot: string): Promise<void> {
  await runAllowFailure(projectRoot, ['reset', '-q']);
}

/** Whether anything is currently staged. */
export async function hasStagedChanges(projectRoot: string): Promise<boolean> {
  // `--quiet` exits 1 to mean "there is a difference", so the exit status is
  // the answer rather than an error.
  const result = await runAllowFailure(projectRoot, ['diff', '--cached', '--quiet']);
  return result.status !== 0;
}

/**
 * Read the repository state shown in the dialog before anything is committed.
 *
 * `ahead` matters because a commit is not always the thing that needs pushing:
 * if an earlier commit failed to push, the button must still push it even with
 * a clean tree.
 */
export async function getRepoState(projectRoot: string): Promise<RepoState> {
  // `rev-parse --abbrev-ref HEAD` fails on a repository with no commits yet,
  // because HEAD points at an unborn branch. Fall back to the short symbolic
  // name so the dialog reports something usable instead of a git stack trace.
  let branch: string;
  try {
    branch = (await run(projectRoot, ['rev-parse', '--abbrev-ref', 'HEAD'])).stdout.trim();
  } catch {
    const short = await runAllowFailure(projectRoot, ['symbolic-ref', '--short', 'HEAD']);
    branch = short.status === 0 && short.stdout.trim() ? short.stdout.trim() : 'HEAD (未初始化)';
  }

  const statusResult = await run(projectRoot, ['status', '--porcelain']);
  const changedFiles = statusResult.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  // `@{u}` is unset on a branch that has never been pushed, which git reports
  // as a non-zero exit rather than an empty line. An unborn HEAD also has no
  // upstream, so this covers both cases.
  const upstreamResult = await runAllowFailure(projectRoot, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  const hasUpstream = upstreamResult.status === 0 && upstreamResult.stdout.trim().length > 0;

  let ahead = 0;
  if (hasUpstream) {
    const countResult = await run(projectRoot, ['rev-list', '--count', '@{u}..HEAD']);
    ahead = Number.parseInt(countResult.stdout.trim(), 10) || 0;
  }

  return { branch, hasUpstream, changedFiles, ahead };
}

export interface CommitAndPushResult {
  /** Subject actually recorded in the commit. */
  subject: string;
  /** Whether a commit was created (false when pushing pre-existing commits only). */
  committed: boolean;
  /** Whether `git push` ran and succeeded. */
  pushed: boolean;
  /** `git show --stat` summary of the new commit. */
  stat: string;
}

/**
 * Commit the staged tree and push.
 *
 * Assumes the caller has already staged (and linted) — the index state is the
 * caller's business, because the lint gate has to run against a staged tree and
 * undo its own staging when it fails.
 *
 * Ordering is deliberate: commit first, then push. If the push fails the commit
 * still exists locally, so the work is never lost and the button can be pressed
 * again to retry just the push.
 *
 * A clean tree with unpushed commits is a valid state to run in — the new post
 * may already be committed by an earlier, failed push — so an empty commit is
 * skipped rather than treated as an error.
 */
export async function commitAndPush(projectRoot: string, rawSubject: string): Promise<CommitAndPushResult> {
  const subject = rawSubject.trim();
  if (!subject) {
    throw new GitCommandError('提交信息不能为空', 400, '');
  }
  if (subject.length > MAX_SUBJECT_LENGTH) {
    throw new GitCommandError(`提交信息不能超过 ${MAX_SUBJECT_LENGTH} 个字符`, 400, '');
  }

  const before = await getRepoState(projectRoot);
  if (!before.hasUpstream) {
    throw new GitCommandError(
      `当前分支 ${before.branch} 没有设置上游远程分支，请先执行 git push -u origin ${before.branch}`,
      400,
      '',
    );
  }

  await stageAll(projectRoot);

  let committed = false;
  if (await hasStagedChanges(projectRoot)) {
    await run(projectRoot, ['commit', '-m', subject]);
    committed = true;
  }

  await run(projectRoot, ['push']);

  return {
    subject,
    committed,
    pushed: true,
    stat: committed ? (await run(projectRoot, ['show', '--stat', '--oneline', 'HEAD'])).stdout.trim() : '',
  };
}
