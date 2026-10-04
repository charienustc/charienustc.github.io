/**
 * Image Upload Helpers
 *
 * Pure functions behind the CMS upload endpoint. Kept free of filesystem and
 * HTTP access so the security-relevant decisions — what counts as an image, and
 * what the resulting file is called — can be unit tested directly.
 *
 * The trust model matters here. The browser supplies both a filename and a
 * `Content-Type`, and neither is evidence of anything: a caller can label a
 * script `photo.png`. So the type is decided by sniffing the actual leading
 * bytes, and the extension written to disk is derived from that sniffed type
 * rather than from whatever the upload claimed.
 */

/** Image formats the upload endpoint accepts. */
export type SniffedImageType = 'image/avif' | 'image/gif' | 'image/jpeg' | 'image/png' | 'image/webp';

/** What a successful sniff yields: the real type and the extension to write. */
export interface SniffedImage {
  type: SniffedImageType;
  extension: string;
}

/**
 * Largest upload accepted, in bytes.
 *
 * Uploads land in `public/`, which is tracked by git and shipped in the static
 * build, so an oversized image is not a transient mistake — it stays in the
 * repository's history. 5 MB comfortably covers a screenshot or a phone photo
 * while keeping that cost bounded.
 */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Human-readable form of `MAX_UPLOAD_BYTES`, for error messages. */
export const MAX_UPLOAD_LABEL = '5 MB';

/** Bytes 0-3 of a PNG file: the 8-byte signature's first half. */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];

/**
 * Read the signature at a fixed offset.
 *
 * @param bytes - Leading bytes of the file
 * @param offset - Where the signature starts
 * @param signature - Expected byte values
 * @returns True when every expected byte matches
 */
function matchesAt(bytes: Uint8Array, offset: number, signature: number[]): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

/**
 * Decode the ASCII of a byte range, for signature checks written as text.
 *
 * @param bytes - Leading bytes of the file
 * @param offset - Where the text starts
 * @param length - How many characters to read
 * @returns The decoded string, or an empty string when the range is short
 */
function asciiAt(bytes: Uint8Array, offset: number, length: number): string {
  if (bytes.length < offset + length) return '';
  let out = '';
  for (let i = 0; i < length; i += 1) out += String.fromCharCode(bytes[offset + i] ?? 0);
  return out;
}

/**
 * Identify an image from its magic bytes.
 *
 * Returns null for anything that is not a recognised image, which is what lets
 * the endpoint reject a renamed executable instead of writing it into
 * `public/` under an image extension.
 *
 * WebP and AVIF are both RIFF/ISO-BMFF containers, so a plain byte prefix is
 * not enough — the format tag deeper in the header is checked too, or a `.wav`
 * would pass as a WebP.
 *
 * @param bytes - The leading bytes of the uploaded file
 * @returns The detected type and extension, or null when unrecognised
 */
export function sniffImageType(bytes: Uint8Array): SniffedImage | null {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (matchesAt(bytes, 0, PNG_SIGNATURE) && matchesAt(bytes, 4, [0x0d, 0x0a, 0x1a, 0x0a])) {
    return { type: 'image/png', extension: 'png' };
  }

  // JPEG: FF D8 FF
  if (matchesAt(bytes, 0, [0xff, 0xd8, 0xff])) {
    return { type: 'image/jpeg', extension: 'jpg' };
  }

  // GIF: "GIF87a" or "GIF89a"
  const gif = asciiAt(bytes, 0, 6);
  if (gif === 'GIF87a' || gif === 'GIF89a') {
    return { type: 'image/gif', extension: 'gif' };
  }

  // WebP: "RIFF" .... "WEBP" — the tag at offset 8 is what distinguishes it
  // from every other RIFF container.
  if (asciiAt(bytes, 0, 4) === 'RIFF' && asciiAt(bytes, 8, 4) === 'WEBP') {
    return { type: 'image/webp', extension: 'webp' };
  }

  // AVIF: ISO-BMFF box whose brand is 'avif' (or the 'avis' still-image
  // sequence). The box size occupies bytes 0-3 and 'ftyp' sits at 4-7.
  if (asciiAt(bytes, 4, 4) === 'ftyp') {
    const brand = asciiAt(bytes, 8, 4);
    if (brand === 'avif' || brand === 'avis') {
      return { type: 'image/avif', extension: 'avif' };
    }
  }

  return null;
}

/**
 * Reduce an arbitrary uploaded filename to a safe slug.
 *
 * Keeps only lowercase alphanumerics and single hyphens. Everything else —
 * separators, dots, unicode, control characters — is dropped, so the result can
 * never introduce a path segment or a second extension.
 *
 * @param originalName - The filename as supplied by the browser
 * @param maxLength - Longest slug to produce
 * @returns A slug from the stem, or an empty string when nothing survives
 */
export function slugifyUploadName(originalName: string, maxLength = 40): string {
  // Drop any directory part first: some browsers send a full path, and a
  // basename call here is what stops `../../evil.png` mattering.
  const base = originalName.split(/[/\\]/).pop() ?? '';
  // Strip the extension, then slugify what remains.
  const stem = base.replace(/\.[^.]*$/, '');

  const slug = stem
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (slug.length <= maxLength) return slug;
  const truncated = slug.slice(0, maxLength);
  const lastSeparator = truncated.lastIndexOf('-');
  return (lastSeparator > 0 ? truncated.slice(0, lastSeparator) : truncated).replace(/-+$/, '');
}

/**
 * Format a timestamp as a filename prefix.
 *
 * Local time, and second-resolution: images are sorted by upload time in a
 * directory listing, which makes a truncated prefix obvious at a glance.
 *
 * @param date - Upload time
 * @returns `YYYYMMDD-HHmmss`
 */
export function uploadFileStamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `${day}-${time}`;
}

/**
 * Build the filename an upload will be stored under.
 *
 * The extension always comes from the sniffed type, never from the uploaded
 * name — that is the whole point, since the name is attacker-controlled.
 *
 * @param originalName - The filename as supplied by the browser
 * @param image - The sniffed type
 * @param date - Upload time
 * @returns A filename relative to the upload directory
 */
export function buildUploadFileName(originalName: string, image: SniffedImage, date: Date): string {
  const slug = slugifyUploadName(originalName);
  const stamp = uploadFileStamp(date);
  return slug ? `${stamp}-${slug}.${image.extension}` : `${stamp}.${image.extension}`;
}

/**
 * Render a Markdown image reference for an uploaded file.
 *
 * Uses the alt text as the caption, since the feed's image pipeline turns a
 * non-empty alt into a visible `<figcaption>`.
 *
 * @param publicPath - Site-absolute path, e.g. `/img/moments/x.webp`
 * @param alt - Optional alt text
 * @returns A Markdown image reference
 */
export function buildMarkdownImage(publicPath: string, alt = ''): string {
  // Brackets and parentheses would terminate the alt text / destination early,
  // so they are replaced rather than escaped — the alt text is decorative.
  const safeAlt = alt.replace(/[[\]]/g, '').trim();
  return `![${safeAlt}](${publicPath})`;
}
