/**
 * CMS Image Upload API Handler
 *
 * Accepts one image from the composer, validates it, and writes it under
 * `public/img/moments/`, returning the site-absolute path to insert into the
 * moment body.
 *
 * Validation is done on the bytes, not on the request's metadata. See
 * `@/lib/uploads` for why: the filename and `Content-Type` are both supplied by
 * the caller and neither is evidence of what the file actually is.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { Context } from 'hono';
import { MOMENT_UPLOADS_DIR, MOMENT_UPLOADS_PUBLIC_PATH } from '@/lib/paths';
import { buildMarkdownImage, buildUploadFileName, MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL, sniffImageType } from '@/lib/uploads';
import { isPathSafe } from '@/lib/validation';

/** Accepts only the fields the composer sends; anything else is ignored. */
const ALLOWED_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif'] as const;

/**
 * Extract the uploaded file from the request.
 *
 * @param c - Hono context
 * @returns The file plus its declared name, or null when the body is not a
 *          multipart form carrying a `file` part
 */
async function readUpload(c: Context): Promise<{ bytes: Uint8Array; name: string; alt: string } | null> {
  const body = await c.req.parseBody();
  const file = body.file;

  if (!file || typeof file === 'string') return null;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const alt = typeof body.alt === 'string' ? body.alt : '';
  return { bytes, name: file.name || 'image', alt };
}

/**
 * POST /api/cms/upload
 *
 * Request: `multipart/form-data` with a `file` part, plus an optional `alt` part
 * used as the inserted Markdown alt text.
 *
 * Response: `{ success, url, markdown, fileName }`
 */
export async function uploadImageHandler(c: Context) {
  const projectRoot = c.get('projectRoot') as string;

  try {
    const upload = await readUpload(c);
    if (!upload) {
      return c.json({ error: 'Missing file. Send multipart/form-data with a "file" part.' }, 400);
    }

    const { bytes, name, alt } = upload;

    if (bytes.byteLength === 0) {
      return c.json({ error: 'The uploaded file is empty.' }, 400);
    }

    // Checked before sniffing so an oversized body is rejected without doing
    // any further work on it. `parseBody` has already buffered the request, so
    // this bounds what gets written to disk, not what gets read into memory.
    if (bytes.byteLength > MAX_UPLOAD_BYTES) {
      return c.json(
        { error: `Image is too large (${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB). The limit is ${MAX_UPLOAD_LABEL}.` },
        413,
      );
    }

    const image = sniffImageType(bytes);
    if (!image) {
      return c.json({ error: `Unsupported file. Accepted formats: ${ALLOWED_IMAGE_EXTENSIONS.join(', ')}.` }, 415);
    }

    const now = new Date();
    const fileName = buildUploadFileName(name, image, now);

    // The generated name is built from a slug and a timestamp, so this should
    // never trip; it is kept because the name reaches `path.join` below and a
    // defence that only holds because of an invariant elsewhere is one refactor
    // away from not holding at all.
    if (!isPathSafe(fileName)) {
      return c.json({ error: 'Invalid file path' }, 400);
    }

    const dir = path.join(projectRoot, MOMENT_UPLOADS_DIR);
    await fs.mkdir(dir, { recursive: true });

    // Append a counter rather than overwrite when a name is taken. Two uploads
    // within the same second would otherwise collide and silently discard the
    // first — the same failure the moment writer guards against.
    let finalName = fileName;
    let collision = 1;
    while (await fileExists(path.join(dir, finalName))) {
      const ext = path.extname(fileName);
      const stem = fileName.slice(0, -ext.length);
      finalName = `${stem}-${collision}${ext}`;
      collision += 1;
    }

    await fs.writeFile(path.join(dir, finalName), bytes);

    const url = `${MOMENT_UPLOADS_PUBLIC_PATH}/${finalName}`;

    return c.json(
      {
        success: true,
        url,
        fileName: finalName,
        markdown: buildMarkdownImage(url, alt),
      },
      201,
    );
  } catch (error) {
    console.error('[CMS Upload API] Error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  return fs
    .access(filePath)
    .then(() => true)
    .catch(() => false);
}
