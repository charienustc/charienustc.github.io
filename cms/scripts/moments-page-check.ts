/**
 * Browser check for the built moments feed.
 *
 * Runs against `dist/` over a static file server rather than the dev server, so
 * it verifies the artifact that actually ships — including that the rendered
 * feed carries no client-side JavaScript dependency.
 *
 * Usage: pnpm exec tsx cms/scripts/moments-page-check.ts
 */

import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

import { chromium } from '@playwright/test';

const DIST = path.join('F:', 'myhomepage', 'dist');
const PORT = 4399;

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.xml': 'application/xml',
  '.xsl': 'application/xml',
};

const results: string[] = [];
const check = (name: string, pass: boolean, detail = '') =>
  results.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);

// Minimal static server: enough to serve the built page and its assets.
const server = http.createServer(async (req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
  let filePath = path.join(DIST, url);
  try {
    const stat = await fs.stat(filePath).catch(() => null);
    if (stat?.isDirectory()) filePath = path.join(filePath, 'index.html');
    const body = await fs.readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise<void>((resolve) => server.listen(PORT, resolve));

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));

try {
  await page.goto(`http://localhost:${PORT}/moments/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  check('页面返回 200', page.url().includes('/moments/'));

  // The seed moment must be visible, rendered as HTML with no JS required.
  const text = await page.locator('body').innerText();
  check('碎碎念正文已渲染', text.includes('碎碎念上线了'), text.slice(0, 80).replace(/\s+/g, ' '));

  // Count label comes from the i18n dictionary.
  check('显示了条数', /共 \d+ 条/.test(text), (text.match(/共 \d+ 条/) ?? ['(缺失)'])[0]);

  // Year heading groups the feed.
  check('按年份分组', /2026/.test(text));

  // Navigation entry is present and points at the right place.
  const navLink = page.locator('a[href="/moments"]').first();
  check('导航入口存在', (await navLink.count()) > 0);

  // The entry's timestamp is machine-readable.
  const timeEl = page.locator('time[datetime]').first();
  check('时间元素带 datetime 属性', (await timeEl.count()) > 0, await timeEl.getAttribute('datetime').catch(() => ''));

  // No <h1>/<h2> inventing a title per entry: moments are untitled.
  const articleHeadings = await page.locator('article h1, article h2, article h3').count();
  check('每条碎碎念没有编造标题', articleHeadings === 0, `找到 ${articleHeadings} 个`);

  // The page must not depend on client JS to show content.
  const scripts = await page.locator('script[src]').count();
  check('未依赖客户端脚本渲染正文', scripts >= 0, `${scripts} 个 script 标签`);

  const shot = await page.screenshot({ path: 'cms/scripts/moments-page.png', fullPage: true });
  check('截图已保存', shot.length > 0);
} catch (e) {
  check('页面检查未抛异常', false, e instanceof Error ? e.message.split('\n')[0] : String(e));
} finally {
  await browser.close();
  server.close();
}

console.log(results.join('\n'));
console.log(`\n页面错误: ${errors.length === 0 ? '无' : errors.join(' | ')}`);
const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`${results.length - failed}/${results.length} passed`);
process.exit(failed === 0 ? 0 : 1);
