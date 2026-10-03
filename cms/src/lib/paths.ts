/**
 * CMS Path Constants
 *
 * Shared path constants for the CMS backend.
 */

/** Content directory relative to project root */
export const CONTENT_DIR = 'src/content/blog';

/**
 * Moments ("碎碎念") directory relative to project root.
 *
 * Deliberately a sibling constant rather than a parameter threaded through the
 * post handlers: the two collections have different shapes (moments have no
 * title, no categories, no per-item route), and sharing a code path would mean
 * either bending one to fit the other or branching on every field.
 */
export const MOMENTS_DIR = 'src/content/moments';

/** Config file path relative to project root */
export const CONFIG_PATH = 'config/site.yaml';

/**
 * Directory deleted posts are moved into instead of being unlinked.
 *
 * Sits under `backups/`, which is already gitignored and already used by the
 * koharu CLI. That makes it a local safety net, not version control — a deleted
 * post still shows as a deletion in `git status`.
 *
 * `pnpm koharu clean` only ever removes `*.tar.gz` files, so it will not sweep
 * this directory.
 */
export const DELETED_POSTS_DIR = 'backups/deleted';

/**
 * Directory holding the previous revision of an edited moment.
 *
 * Separate from `DELETED_POSTS_DIR` on purpose. Editing is a routine,
 * expected action while deletion is not, so versions accumulate much faster;
 * mixing them would make the deleted bin stop reading as "these were removed
 * by mistake". Sits under `backups/` for the same reason: gitignored, local,
 * and never touched by `pnpm koharu clean` (which only removes `*.tar.gz`).
 */
export const MOMENT_VERSIONS_DIR = 'backups/versions';

/** Suffix marking a file as a retained copy rather than a live post. */
export const DELETED_POST_SUFFIX = '.deleted';

/** Number of recent posts to show in dashboard overview */
export const RECENT_POSTS_COUNT = 10;

/** Maximum categories to display in overview */
export const MAX_CATEGORY_DISPLAY = 10;

/** Maximum recent posts to display in overview */
export const MAX_RECENT_POSTS_DISPLAY = 5;
