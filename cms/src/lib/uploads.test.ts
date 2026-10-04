/**
 * Unit tests for image upload helpers.
 *
 * The magic-byte checks are the security-relevant part: the endpoint decides
 * whether a file is an image from these, and a false positive means a
 * non-image gets written into `public/` under an image extension.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildMarkdownImage,
  buildUploadFileName,
  MAX_UPLOAD_BYTES,
  slugifyUploadName,
  sniffImageType,
  uploadFileStamp,
} from './uploads';

/** Build a byte array from a signature given as hex pairs. */
function bytesOf(hex: string, padTo = 32): Uint8Array {
  const clean = hex.replace(/\s/g, '');
  const bytes = new Uint8Array(Math.max(padTo, clean.length / 2));
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = Number.parseInt(clean.slice(i, i + 2), 16);
  }
  return bytes;
}

/** Build a byte array from an ASCII prefix. */
function asciiOf(text: string, padTo = 32): Uint8Array {
  const bytes = new Uint8Array(padTo);
  for (let i = 0; i < text.length; i += 1) bytes[i] = text.charCodeAt(i);
  return bytes;
}

const PNG = bytesOf('89504e470d0a1a0a');
const JPEG = bytesOf('ffd8ffe00010');
const GIF87 = asciiOf('GIF87a');
const GIF89 = asciiOf('GIF89a');
const WEBP = asciiOf('RIFF\x00\x00\x00\x00WEBP');
const AVIF = asciiOf('\x00\x00\x00\x20ftypavif');
const AVIS = asciiOf('\x00\x00\x00\x20ftypavis');

// --- sniffImageType ---

test('detects PNG from its 8-byte signature', () => {
  assert.deepEqual(sniffImageType(PNG), { type: 'image/png', extension: 'png' });
});

test('detects JPEG from FF D8 FF', () => {
  assert.deepEqual(sniffImageType(JPEG), { type: 'image/jpeg', extension: 'jpg' });
});

test('detects both GIF versions', () => {
  assert.deepEqual(sniffImageType(GIF87), { type: 'image/gif', extension: 'gif' });
  assert.deepEqual(sniffImageType(GIF89), { type: 'image/gif', extension: 'gif' });
});

test('detects WebP from the RIFF container', () => {
  assert.deepEqual(sniffImageType(WEBP), { type: 'image/webp', extension: 'webp' });
});

test('detects AVIF stills and sequences', () => {
  assert.deepEqual(sniffImageType(AVIF), { type: 'image/avif', extension: 'avif' });
  assert.deepEqual(sniffImageType(AVIS), { type: 'image/avif', extension: 'avif' });
});

test('rejects a RIFF container that is not WebP', () => {
  // A WAV shares RIFF with WebP. Checking only the first four bytes would let
  // an audio file through dressed as an image.
  const wav = asciiOf('RIFF\x00\x00\x00\x00WAVE');
  assert.equal(sniffImageType(wav), null);
});

test('rejects an ISO-BMFF container that is not AVIF', () => {
  const mp4 = asciiOf('\x00\x00\x00\x20ftypisom');
  assert.equal(sniffImageType(mp4), null);
});

test('rejects a PNG signature truncated mid-way', () => {
  const truncated = new Uint8Array([0x89, 0x50, 0x4e]);
  assert.equal(sniffImageType(truncated), null);
});

test('rejects text, scripts, and empty input', () => {
  assert.equal(sniffImageType(asciiOf('<script>alert(1)</script>')), null);
  assert.equal(sniffImageType(new Uint8Array(0)), null);
});

test('rejects a shell script named like an image', () => {
  // The endpoint never sees the filename here on purpose: this is exactly the
  // case where trusting the name or Content-Type would be wrong.
  assert.equal(sniffImageType(asciiOf('#!/bin/sh\nrm -rf /')), null);
});

// --- slugifyUploadName ---

test('slugifies a filename into a lowercase hyphenated stem', () => {
  assert.equal(slugifyUploadName('My Photo 2026.PNG'), 'my-photo-2026');
});

test('drops a directory part so traversal cannot survive', () => {
  assert.equal(slugifyUploadName('../../etc/passwd.png'), 'passwd');
  assert.equal(slugifyUploadName('C:\\Users\\me\\shot.jpg'), 'shot');
});

test('strips characters that could introduce a second extension', () => {
  // The dot is removed with everything else, so no `.php` tail can be smuggled
  // through and appended to the generated name.
  assert.equal(slugifyUploadName('evil.php.png'), 'evil-php');
});

test('returns an empty slug when nothing usable remains', () => {
  assert.equal(slugifyUploadName('图片.png'), '');
  assert.equal(slugifyUploadName('---.png'), '');
  assert.equal(slugifyUploadName('.png'), '');
});

test('truncates a long slug at a hyphen boundary', () => {
  const long = `${'a'.repeat(30)}-${'b'.repeat(30)}.png`;
  const slug = slugifyUploadName(long, 20);
  assert.ok(slug.length <= 20, `expected <= 20 chars, got ${slug.length}`);
  assert.ok(!slug.endsWith('-'), 'must not end on a separator');
});

// --- uploadFileStamp ---

test('formats a timestamp as YYYYMMDD-HHmmss in local time', () => {
  assert.equal(uploadFileStamp(new Date(2026, 9, 4, 21, 5, 9)), '20261004-210509');
});

test('pads single-digit parts', () => {
  assert.equal(uploadFileStamp(new Date(2026, 0, 5, 4, 3, 2)), '20260105-040302');
});

// --- buildUploadFileName ---

test('takes the extension from the sniffed type, not the uploaded name', () => {
  // The name says .png but the bytes are a JPEG; the stored file must be .jpg,
  // otherwise the extension would be a claim rather than a fact.
  const name = buildUploadFileName('photo.png', { type: 'image/jpeg', extension: 'jpg' }, new Date(2026, 9, 4, 21, 5, 9));
  assert.equal(name, '20261004-210509-photo.jpg');
});

test('omits the slug when the name yields nothing usable', () => {
  const name = buildUploadFileName('图片.png', { type: 'image/png', extension: 'png' }, new Date(2026, 9, 4, 21, 5, 9));
  assert.equal(name, '20261004-210509.png');
});

test('produces a name with exactly one extension', () => {
  const name = buildUploadFileName('a.b.c.d.png', { type: 'image/png', extension: 'png' }, new Date(2026, 9, 4, 21, 5, 9));
  assert.equal(name.match(/\./g)?.length, 1, `expected one dot in ${name}`);
});

// --- buildMarkdownImage ---

test('builds a Markdown image reference', () => {
  assert.equal(buildMarkdownImage('/img/moments/a.webp', '猫猫'), '![猫猫](/img/moments/a.webp)');
});

test('omits brackets from alt text so the reference stays parseable', () => {
  assert.equal(buildMarkdownImage('/img/moments/a.webp', 'a [b] c'), '![a b c](/img/moments/a.webp)');
});

test('allows an empty alt text', () => {
  assert.equal(buildMarkdownImage('/img/moments/a.webp'), '![](/img/moments/a.webp)');
});

// --- limits ---

test('exposes a whole-number megabyte limit', () => {
  assert.equal(MAX_UPLOAD_BYTES, 5 * 1024 * 1024);
});
