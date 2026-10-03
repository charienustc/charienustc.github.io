/**
 * Markdown Body Normalization
 *
 * Repairs the body text produced by the BlockNote editor before it is written
 * to disk.
 *
 * ## The problem this exists for
 *
 * BlockNote represents a line break *inside* a paragraph as a `hardBreak` node.
 * Its markdown serializer (`blocksToMarkdownLossy`) writes that node as a
 * backslash followed by a newline, which is valid CommonMark and so looks
 * harmless. It is not harmless here, for two compounding reasons:
 *
 *   1. Re-reading the file turns that backslash back into a `hardBreak`, so the
 *      serializer writes it out again — the file never stabilises.
 *   2. Each round-trip *doubles* the marker. A file with 33 hard breaks came
 *      back with 66 backslashes after one save in the editor.
 *
 * The result is a post that grows a layer of stray backslashes every time it is
 * opened and saved, which is what a user sees as "the editor keeps adding
 * junk to my text".
 *
 * ## The fix
 *
 * Rewrite the escaped-break form as a trailing double space, which is the other
 * CommonMark hard-break syntax and renders identically. BlockNote reads a double
 * space as a `hardBreak` too, so the visual result is unchanged — but a double
 * space is not re-emitted as a backslash, so the cycle stops.
 *
 * Any *genuine* line-final backslash is indistinguishable from a serialized
 * break, so it is converted as well. That is the correct trade: a literal
 * backslash at end of line is either an escaped line break (what we want) or a
 * valueless stray character in prose. Inside fenced and indented code blocks it
 * can be meaningful (a Python continuation, a shell line continuation), so those
 * regions are left untouched.
 */

/** A fenced code block's opening or closing delimiter, e.g. ``` or ~~~ . */
const FENCE_PATTERN = /^(\s{0,3})(`{3,}|~{3,})/;

/**
 * Rewrite BlockNote's escaped line breaks as trailing double spaces.
 *
 * Code fences and indented code blocks are preserved verbatim, because a
 * line-final backslash there is likely deliberate.
 *
 * @param body - Markdown body, with frontmatter already stripped
 * @returns The body with escaped breaks normalized
 */
export function normalizeEscapedLineBreaks(body: string): string {
  const lines = body.split('\n');
  const out: string[] = [];

  /** Delimiter that opened the fence we are inside, or null. */
  let openFence: string | null = null;

  for (const line of lines) {
    // Track fenced code blocks. Inside one, copy the line through untouched.
    const fence = line.match(FENCE_PATTERN);
    const delimiter = fence?.[2];
    if (delimiter) {
      if (openFence === null) {
        openFence = delimiter;
      } else if (
        // A closing fence uses the same character and is at least as long.
        delimiter[0] === openFence[0] &&
        delimiter.length >= openFence.length
      ) {
        openFence = null;
      }
      out.push(line);
      continue;
    }

    // An indented code block (4+ spaces) is verbatim too — but only outside a
    // fence, where indentation is not significant to the block structure.
    if (openFence !== null || /^ {4}/.test(line)) {
      out.push(line);
      continue;
    }

    // A bare backslash is the same marker with no text to attach to. It is
    // dropped entirely rather than rewritten, because turning it into a
    // two-space line would leave a blank-looking line that splits one stanza
    // into two paragraphs. This must be checked before the line-final rule,
    // which would otherwise consume it.
    if (line.trim() === '\\') {
      continue;
    }

    // Only rewrite a backslash that is the last non-space character, and keep
    // any trailing whitespace the author had rather than inventing a new break.
    if (/\\\s*$/.test(line)) {
      const withoutBackslash = line.replace(/\\\s*$/, '');
      out.push(`${withoutBackslash}  `);
      continue;
    }

    out.push(line);
  }

  return out.join('\n');
}
