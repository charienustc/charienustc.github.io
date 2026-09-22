import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// 用户站点 charienustc.github.io,无需配置 base。
export default defineConfig({
  site: 'https://charienustc.github.io',
  vite: {
    plugins: [tailwindcss()],
    css: {
      transformer: 'postcss',
      lightningcss: {
        targets: {
          chrome: 120,
          safari: 17,
          firefox: 120,
        },
      },
    },
  },
  integrations: [mdx(), sitemap()],
});
