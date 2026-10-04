/**
 * CMS API Client
 *
 * Client-side functions for reading and writing blog posts via the CMS API.
 */

import { format, isValid, parse, parseISO } from 'date-fns';
import type {
  BlogSchema,
  CreateMomentParams,
  CreateMomentResponse,
  CreatePostParams,
  CreatePostResponse,
  DeletePostResponse,
  GitCommitPushResponse,
  GitStatusResponse,
  ListMomentsResponse,
  ListPostsParams,
  ListPostsResponse,
  ReadMomentResponse,
  ReadPostResult,
  ToggleDraftResponse,
  ToggleStickyResponse,
  UpdateMomentParams,
  UpdateMomentResponse,
  UploadImageResponse,
} from '@/types';
import { setCategoryMap } from './category';

/**
 * Encode a slug for URL usage
 */
function encodeSlug(slug: string): string {
  return encodeURIComponent(slug);
}

/**
 * Safely parses a date string with fallback handling
 *
 * Supports multiple formats:
 * - "yyyy-MM-dd HH:mm:ss" (local time format)
 * - ISO 8601 format (e.g., "2026-01-03T12:00:00.000Z")
 *
 * @param dateStr - The date string to parse
 * @returns A valid Date object, or the current date if parsing fails
 */
function safeParseDateString(dateStr: string): Date {
  // Try ISO format first (contains 'T')
  if (dateStr.includes('T')) {
    const isoDate = parseISO(dateStr);
    if (isValid(isoDate)) {
      return isoDate;
    }
  }

  // Try local time format "yyyy-MM-dd HH:mm:ss"
  const localDate = parse(dateStr, 'yyyy-MM-dd HH:mm:ss', new Date());
  if (isValid(localDate)) {
    return localDate;
  }

  // Try date-only format "yyyy-MM-dd"
  const dateOnly = parse(dateStr, 'yyyy-MM-dd', new Date());
  if (isValid(dateOnly)) {
    return dateOnly;
  }

  // Fallback: return current date
  console.warn(`[CMS API] Failed to parse date string: "${dateStr}", using current date`);
  return new Date();
}

/**
 * Serialize a Date object to local time string for API transmission
 * Preserves the user's intended time without UTC conversion
 *
 * @param date - Date object to serialize
 * @returns Local time string in "yyyy-MM-dd HH:mm:ss" format
 */
function serializeDateForApi(date: Date): string {
  return format(date, 'yyyy-MM-dd HH:mm:ss');
}

/**
 * Prepare frontmatter for API transmission
 * Converts Date objects to local time strings to prevent JSON.stringify
 * from converting them to UTC ISO format
 *
 * @param frontmatter - BlogSchema frontmatter object
 * @returns Frontmatter with Date objects converted to strings
 */
function prepareFrontmatterForApi(frontmatter: BlogSchema): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(frontmatter)) {
    if (value instanceof Date) {
      result[key] = serializeDateForApi(value);
    } else if (value !== undefined && value !== null) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Reads a blog post from the CMS API
 *
 * @param postId - The post ID (e.g., 'note/front-end/theme.md')
 * @returns The frontmatter and content of the post
 * @throws Error if the request fails
 */
export async function readPost(postId: string): Promise<ReadPostResult> {
  const response = await fetch(`/api/cms/read?postId=${encodeSlug(postId)}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to read post: ${response.status}`);
  }

  const data = await response.json();

  // Convert date strings to Date objects with safe parsing
  if (data.frontmatter.date && typeof data.frontmatter.date === 'string') {
    data.frontmatter.date = safeParseDateString(data.frontmatter.date);
  }
  if (data.frontmatter.updated && typeof data.frontmatter.updated === 'string') {
    data.frontmatter.updated = safeParseDateString(data.frontmatter.updated);
  }

  return data as ReadPostResult;
}

/**
 * Writes a blog post via the CMS API
 *
 * @param postId - The post ID (e.g., 'note/front-end/theme.md')
 * @param frontmatter - The post frontmatter
 * @param content - The post content (markdown)
 * @param categoryMappings - Optional new category mappings to add to config/site.yaml
 * @throws Error if the request fails
 */
export async function writePost(
  postId: string,
  frontmatter: BlogSchema,
  content: string,
  categoryMappings?: Record<string, string>,
): Promise<void> {
  const response = await fetch('/api/cms/write', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      postId,
      frontmatter: prepareFrontmatterForApi(frontmatter),
      content,
      categoryMappings,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to write post: ${response.status}`);
  }
}

/**
 * Lists all blog posts with metadata and statistics
 *
 * @param params - Optional filter/sort parameters
 * @returns Posts list with statistics
 */
export async function listPosts(params?: ListPostsParams): Promise<ListPostsResponse> {
  const searchParams = new URLSearchParams();

  if (params?.category) searchParams.set('category', params.category);
  if (params?.tag) searchParams.set('tag', params.tag);
  if (params?.status && params.status !== 'all') searchParams.set('status', params.status);
  if (params?.search) searchParams.set('search', params.search);
  if (params?.sort) searchParams.set('sort', params.sort);
  if (params?.order) searchParams.set('order', params.order);

  const queryString = searchParams.toString();
  const url = `/api/cms/list${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to list posts: ${response.status}`);
  }

  return response.json();
}

/**
 * Creates a new blog post
 *
 * @param params - Post creation parameters
 * @returns The created post ID
 */
export async function createPost(params: CreatePostParams): Promise<CreatePostResponse> {
  const response = await fetch('/api/cms/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to create post: ${response.status}`);
  }

  return response.json();
}

/**
 * Toggles the draft status of a post
 *
 * @param postId - The post ID (file path)
 * @returns The new draft status
 */
export async function toggleDraft(postId: string): Promise<ToggleDraftResponse> {
  const response = await fetch('/api/cms/toggle-draft', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ postId }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to toggle draft: ${response.status}`);
  }

  return response.json();
}

/**
 * Toggles the sticky status of a post
 *
 * @param postId - The post ID (file path)
 * @returns The new sticky status
 */
export async function toggleSticky(postId: string): Promise<ToggleStickyResponse> {
  const response = await fetch('/api/cms/toggle-sticky', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ postId }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to toggle sticky: ${response.status}`);
  }

  return response.json();
}

/**
 * Deletes a blog post
 *
 * @param postId - The post ID (file path)
 * @returns The deleted post ID
 */
export async function deletePost(postId: string): Promise<DeletePostResponse> {
  const response = await fetch('/api/cms/delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ postId }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to delete post: ${response.status}`);
  }

  return response.json();
}

/**
 * CMS configuration from server
 */
export interface CMSConfigResponse {
  projectRoot: string;
  contentDir: string;
  categoryMap: Record<string, string>;
}

// Cache for CMS config
let cachedConfig: CMSConfigResponse | null = null;

/**
 * Gets the CMS configuration from the server
 * Results are cached after the first call
 *
 * @returns The CMS configuration
 */
export async function getCMSConfig(): Promise<CMSConfigResponse> {
  if (cachedConfig) {
    return cachedConfig;
  }

  const response = await fetch('/api/cms/config');

  if (!response.ok) {
    throw new Error('Failed to fetch CMS config');
  }

  const config: CMSConfigResponse = await response.json();
  cachedConfig = config;

  // Initialize category map for client-side detection
  setCategoryMap(config.categoryMap);

  return config;
}

/**
 * Reads the repository state for the publish dialog
 *
 * @returns Branch, changed files, and how many commits await pushing
 * @throws Error if the request fails
 */
export async function fetchGitStatus(): Promise<GitStatusResponse> {
  const response = await fetch('/api/cms/git-status');

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to read git status: ${response.status}`);
  }

  return response.json();
}

/**
 * Lints, commits every working-tree change, and pushes
 *
 * The server runs the pre-commit lint check first, so a failure here means
 * nothing was committed. A push failure leaves the commit in place locally.
 *
 * @param params - Conventional-commit type, optional scope, and description
 * @returns What was committed and whether the push succeeded
 * @throws Error carrying the git or lint output when the request fails
 */
export async function commitAndPush(params: {
  type: string;
  scope?: string;
  description: string;
}): Promise<GitCommitPushResponse> {
  const response = await fetch('/api/cms/git-commit-push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to commit and push: ${response.status}`);
  }

  return response.json();
}

/**
 * Lists the moments ("碎碎念") feed
 *
 * @returns Every moment, newest first, with counts and the tag vocabulary
 * @throws Error if the request fails
 */
export async function listMoments(): Promise<ListMomentsResponse> {
  const response = await fetch('/api/cms/moments');
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to list moments: ${response.status}`);
  }
  return response.json();
}

/**
 * Reads one moment for editing
 *
 * @param momentId - Filename relative to the moments directory
 * @returns The body, date, and tags
 * @throws Error if the moment is missing or unreadable
 */
export async function readMoment(momentId: string): Promise<ReadMomentResponse> {
  const response = await fetch(`/api/cms/moments/read?momentId=${encodeURIComponent(momentId)}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to read moment: ${response.status}`);
  }
  return response.json();
}

/**
 * Writes a new moment
 *
 * @param params - Body, and optional date, tags, and draft flag
 * @returns The generated filename
 * @throws Error if the write is rejected
 */
export async function createMoment(params: CreateMomentParams): Promise<CreateMomentResponse> {
  const response = await fetch('/api/cms/moments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to create moment: ${response.status}`);
  }
  return response.json();
}

/**
 * Deletes a moment, retaining it under `backups/deleted/`
 *
 * @param momentId - Filename relative to the moments directory
 * @returns Where the copy was retained
 * @throws Error if the delete is rejected
 */
export async function deleteMoment(momentId: string): Promise<{ success: boolean; retainedPath?: string }> {
  const response = await fetch('/api/cms/moments/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ momentId }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to delete moment: ${response.status}`);
  }
  return response.json();
}

/**
 * Rewrites an existing moment, retaining the previous revision
 *
 * @param params - The moment id plus the fields to write
 * @returns Where the previous revision was kept
 * @throws Error if the update is rejected
 */
export async function updateMoment(params: UpdateMomentParams): Promise<UpdateMomentResponse> {
  const response = await fetch('/api/cms/moments/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to update moment: ${response.status}`);
  }
  return response.json();
}

/**
 * Uploads an image and returns a Markdown reference for it.
 *
 * Sends multipart form data rather than a JSON payload with a data URL: a base64
 * copy of a photo is roughly a third larger, and the server would then have to
 * decode it back into the bytes it needs to inspect.
 *
 * @param file - The image file to upload
 * @param alt - Alt text to use in the returned reference
 * @returns The stored URL and a ready-to-insert Markdown reference
 * @throws Error if the server rejects the file
 */
export async function uploadImage(file: File, alt = ''): Promise<UploadImageResponse> {
  const formData = new FormData();
  formData.append('file', file);
  if (alt) formData.append('alt', alt);

  const response = await fetch('/api/cms/upload', { method: 'POST', body: formData });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to upload image: ${response.status}`);
  }
  return response.json();
}
