/**
 * CMS Git API Handler
 *
 * Backs the one-click "commit and push" flow in the dashboard header.
 *
 * Two endpoints rather than one, because the dialog needs to show what is about
 * to be committed *before* the user presses the button, and again after a
 * failure so the error can be acted on.
 */

import { execFile } from 'node:child_process';
import type { Context } from 'hono';
import { z } from 'zod';
import { buildSubject, summarizeCommandFailure } from '@/lib/commit-message';
import { commitAndPush, GitCommandError, getRepoState, stageAll, unstageAll } from '@/lib/git';

/**
 * Lint check run before the commit.
 *
 * This is the same command `.husky/pre-commit` runs, so a commit that passes
 * here cannot then be rejected by the hook. Running it up front (rather than
 * letting the hook fail) is what makes the error readable: git would otherwise
 * report only "pre-commit hook exited with code 1" and bury the Biome output.
 *
 * The tree MUST be staged before calling this. `lint-staged` only looks at
 * staged files and exits 0 with "No staged files found." when the index is
 * empty — a clean-looking pass that checks nothing. The caller stages first and
 * unstages again if this fails.
 *
 * `shell: true` is required because the binary is `pnpm.cmd` on Windows, and
 * `node_modules/.bin/pnpm` does not exist — Node has refused to spawn `.cmd`
 * without a shell since the CVE-2024-27980 fix.
 *
 * Run from the repository ROOT, not from `cms/`. `lint-staged` discovers its
 * config relative to the git root, and invoking it from `cms/` fails outright
 * with "No valid configuration found" — verified both ways.
 *
 * `--diff` is not usable here: it lints only unstaged changes, which is the
 * opposite of the state this runs in.
 */
const LINT_COMMAND = 'pnpm';
const LINT_ARGS = ['exec', 'lint-staged'];
const LINT_TIMEOUT_MS = 180_000;

const commitRequestSchema = z.object({
  type: z.string().min(1, 'type is required'),
  scope: z.string().optional().default(''),
  description: z.string().min(1, 'description is required'),
});

/** Where the blog repository lives, relative to the CMS. Mirrors server.ts. */
function projectRootOf(c: Context): string {
  return c.get('projectRoot') as string;
}

/**
 * Run the pre-commit lint check.
 *
 * Returns null when it passes, or a human-readable failure when it does not.
 */
function runLint(projectRoot: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      LINT_COMMAND,
      LINT_ARGS,
      { cwd: projectRoot, timeout: LINT_TIMEOUT_MS, shell: true, windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (!error) {
          resolve(null);
          return;
        }
        resolve(summarizeCommandFailure(stderr, stdout));
      },
    );
  });
}

/**
 * GET /api/cms/git-status
 *
 * Repository state for the publish dialog: branch, changed files, and how many
 * commits are waiting to be pushed.
 */
export async function gitStatusHandler(c: Context) {
  try {
    const state = await getRepoState(projectRootOf(c));
    return c.json(state);
  } catch (error) {
    console.error('[CMS Git API] status failed:', error);
    const message = error instanceof GitCommandError ? error.stderr || error.message : '无法读取 git 状态';
    return c.json({ error: message }, 500);
  }
}

/**
 * POST /api/cms/git-commit-push
 *
 * Lint, stage everything, commit, push. The commit is created before the push
 * so a push failure leaves the work committed and locally recoverable.
 */
export async function gitCommitPushHandler(c: Context) {
  const projectRoot = projectRootOf(c);

  let rawBody: unknown;
  try {
    rawBody = await c.req.json();
  } catch {
    return c.json({ error: '请求体不是合法的 JSON' }, 400);
  }

  const parseResult = commitRequestSchema.safeParse(rawBody);
  if (!parseResult.success) {
    return c.json({ error: parseResult.error.errors.map((e) => e.message).join(', ') }, 400);
  }

  const { type, scope, description } = parseResult.data;
  const built = buildSubject(type, scope, description);
  if ('error' in built) {
    return c.json({ error: built.error }, 400);
  }

  try {
    const state = await getRepoState(projectRoot);
    // Nothing in the tree and nothing ahead means there is genuinely nothing to
    // do.
    if (state.changedFiles.length === 0 && state.ahead === 0) {
      return c.json({ error: '没有需要提交的改动' }, 400);
    }

    // Stage before linting: `lint-staged` inspects only the index, so linting an
    // empty index is a no-op that reports success. Staging here (rather than
    // relying on commitAndPush to do it) is what makes the gate meaningful.
    if (state.changedFiles.length > 0) {
      await stageAll(projectRoot);
      const lintError = await runLint(projectRoot);
      if (lintError) {
        // Restore the index to how we found it. lint-staged stages the tree as
        // part of running its tasks and does not unstage on failure; leaving it
        // that way is invisible in the UI but a surprise in a terminal.
        await unstageAll(projectRoot);
        return c.json({ error: `lint 检查未通过，已取消提交：\n\n${lintError}` }, 500);
      }
    }

    const result = await commitAndPush(projectRoot, built.subject);
    return c.json(result);
  } catch (error) {
    if (error instanceof GitCommandError) {
      console.error('[CMS Git API] commit/push failed:', error.message);
      return c.json({ error: error.stderr || error.message }, 500);
    }
    console.error('[CMS Git API] commit/push failed:', error);
    return c.json({ error: '提交或推送失败' }, 500);
  }
}
