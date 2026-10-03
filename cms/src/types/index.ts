/**
 * CMS Type Definitions
 */

/**
 * Configuration for a single editor
 */
export interface EditorConfig {
  /** Unique identifier for the editor */
  id: string;
  /** Display name */
  name: string;
  /** Iconify icon identifier (e.g., 'ri:vscode-line') */
  icon: string;
  /** URL template with placeholders: {path}, {line}, {column} */
  urlTemplate: string;
}

/**
 * CMS configuration from cms.yaml
 */
export interface CMSConfig {
  /** Whether CMS features are enabled (dev only) */
  enabled: boolean;
  /** Absolute path to the local project directory */
  localProjectPath: string;
  /** Relative path from project root to content directory (default: 'src/content/blog') */
  contentRelativePath: string;
  /** List of configured editors */
  editors: EditorConfig[];
}

/**
 * Blog post frontmatter schema
 */
export interface BlogSchema {
  title: string;
  date?: Date;
  updated?: Date;
  description?: string;
  categories?: string | string[] | string[][];
  tags?: string[];
  cover?: string;
  link?: string;
  subtitle?: string;
  draft?: boolean;
  sticky?: boolean;
  tocNumbering?: boolean;
  excludeFromSummary?: boolean;
  math?: boolean;
  quiz?: boolean;
}

/**
 * Result from reading a post
 */
export interface ReadPostResult {
  frontmatter: BlogSchema;
  content: string;
}

/**
 * Post list item for dashboard display
 */
export interface PostListItem {
  id: string;
  slug: string;
  title: string;
  date: string;
  updated?: string;
  categories: string[];
  tags: string[];
  draft: boolean;
  sticky: boolean;
}

/**
 * Dashboard statistics
 */
export interface DashboardStats {
  total: number;
  published: number;
  draft: number;
  categoryStats: { name: string; count: number }[];
  tagStats: { name: string; count: number }[];
  recentPosts: PostListItem[];
}

/**
 * Response from list posts API
 */
export interface ListPostsResponse {
  posts: PostListItem[];
  total: number;
  stats: DashboardStats;
  categories: string[];
  tags: string[];
}

/**
 * Parameters for listing posts
 */
export interface ListPostsParams {
  category?: string;
  tag?: string;
  status?: 'all' | 'draft' | 'published';
  search?: string;
  sort?: 'date' | 'title' | 'updated';
  order?: 'asc' | 'desc';
}

/**
 * Parameters for creating a post
 */
export interface CreatePostParams {
  title: string;
  categories?: string[];
  tags?: string[];
  draft?: boolean;
  categoryMappings?: Record<string, string>;
}

/**
 * Response from create post API
 */
export interface CreatePostResponse {
  success: boolean;
  postId: string;
  message?: string;
}

/**
 * Response from toggle draft API
 */
export interface ToggleDraftResponse {
  success: boolean;
  draft: boolean;
}

/**
 * Response from toggle sticky API
 */
export interface ToggleStickyResponse {
  success: boolean;
  sticky: boolean;
}

/**
 * Response from delete post API
 */
export interface DeletePostResponse {
  success: boolean;
  postId: string;
  /**
   * Where the post was retained, relative to the project root. Absent only if
   * the server skipped retention, which it currently never does.
   */
  retainedPath?: string;
}

/**
 * Repository state for the one-click publish dialog
 */
export interface GitStatusResponse {
  /** Current branch name. */
  branch: string;
  /** Whether the branch has an upstream remote. */
  hasUpstream: boolean;
  /** Files reported by `git status --porcelain`. */
  changedFiles: string[];
  /** Commits present locally but not on the upstream. */
  ahead: number;
}

/**
 * Response from the commit-and-push API
 */
export interface GitCommitPushResponse {
  /** Subject recorded in the commit. */
  subject: string;
  /** Whether a commit was created; false when only pre-existing commits were pushed. */
  committed: boolean;
  /** Whether the push succeeded. */
  pushed: boolean;
  /** `git show --stat` summary of the new commit, empty when nothing was committed. */
  stat: string;
}

/**
 * One moment ("碎碎念") as the dashboard lists it.
 *
 * No title field: a moment's body is its content, and the list shows a preview
 * of that body instead of a heading.
 */
export interface MomentListItem {
  /** Filename relative to the moments directory, e.g. `2026-10-03-153000.md` */
  id: string;
  /** Raw frontmatter date string as written in the file */
  date: string;
  /** Last-edit time, absent until the moment has been edited */
  updated?: string;
  draft: boolean;
  tags: string[];
  /** Opening text of the body, for the list preview */
  preview: string;
  /** Body length in characters, so the composer can show how long it is */
  length: number;
}

/**
 * Response from the list moments API
 */
export interface ListMomentsResponse {
  moments: MomentListItem[];
  total: number;
  draft: number;
  published: number;
  tags: string[];
}

/**
 * Parameters accepted by the create moment API
 */
export interface CreateMomentParams {
  body: string;
  date?: string;
  tags?: string[];
  draft?: boolean;
}

/**
 * Response from the create moment API
 */
export interface CreateMomentResponse {
  success: boolean;
  momentId: string;
}

/**
 * Response from the read moment API
 */
export interface ReadMomentResponse {
  id: string;
  body: string;
  date: string;
  updated?: string;
  draft: boolean;
  tags: string[];
}

/**
 * Parameters accepted by the update moment API
 */
export interface UpdateMomentParams {
  momentId: string;
  body: string;
  tags?: string[];
  draft?: boolean;
}

/**
 * Response from the update moment API
 */
export interface UpdateMomentResponse {
  success: boolean;
  momentId: string;
  /** Where the previous revision was retained, relative to the project root. */
  versionPath?: string;
}
