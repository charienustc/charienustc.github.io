// 站点常量。可编辑字段放在 src/data/site.json(后台可直接修改)。
import site from './data/site.json';

export const SITE_TITLE = site.title;
export const SITE_DESCRIPTION = site.description;
export const AUTHOR = site.author;
export const SITE_URL = site.url;
export const NAV_LINKS = [
  { href: '/', label: '主页' },
  { href: '/portfolio', label: '作品' },
  { href: '/blog', label: '博客' },
  { href: '/links', label: '链接' },
];
