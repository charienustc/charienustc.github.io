# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Personal homepage for `charienustc`, deployed to GitHub Pages at `https://charienustc.github.io`. Built as a static Astro 7 site with a minimal editorial design (warm paper background, serif display type, hairline-rule list rows, light/dark theme toggle).

## Common commands

Use `pnpm` for package management.

- `pnpm dev` — Start Astro dev server (`http://localhost:4321`).
- `pnpm build` — Build the static site into `dist/`.
- `pnpm preview` — Preview the production build locally.
- `pnpm admin` — Start the local content admin server (`http://localhost:4322`). It edits `src/content` and `src/data` in place and can `git commit + push`.

There are no lint, test, or format scripts configured in this repo.

## Architecture

### Astro content collections

Content is defined in `src/content.config.ts` using Astro's `glob` loader:

- `blog` — `src/content/blog/**/*.md|mdx`
- `projects` — `src/content/projects/**/*.md|mdx`

Schemas are enforced with Zod. Draft posts (`draft: true`) are filtered out in `getStaticPaths` and list pages.

### Pages and routing

Static routes live under `src/pages/`:

- `index.astro` — Homepage with typographic hero and featured projects / recent posts as list rows.
- `blog/index.astro` — Post list.
- `blog/[...id].astro` — Individual post renderer; uses `render()` for MDX.
- `blog/tags/` and `blog/tags/[tag].astro` — Tag index and filtered list.
- `blog/archive.astro` — Archive view.
- `portfolio/index.astro` — Projects list.
- `links.astro` — Aggregated social links.

### Layout and components

- `src/layouts/BaseLayout.astro` — Shell: `<html>`, `<Header>`, `<Footer>`, main container, imports global styles and the scroll-reveal script.
- `src/components/BaseHead.astro` — Meta, OG tags, fonts, inline theme initializer (reads `localStorage.theme`, falls back to system preference), and Busuanzi analytics script.
- `src/components/PageHeader.astro` — Shared page header: mono kicker label + large serif title + optional description.
- `src/components/PostCard.astro` / `src/components/ProjectCard.astro` — Editorial list-row items (hairline dividers, hover arrow slide), used on home, blog, tags, and portfolio pages.

### Styling

- Tailwind CSS v4 is loaded via `@tailwindcss/vite` in `astro.config.mjs`.
- `src/styles/global.css` defines the design tokens and `@theme inline` mappings. Theme colors are CSS custom properties that flip between light (default) and `.dark` modes (dark is a custom variant on the `.dark` class).
- The default theme is light. User preference (`localStorage.theme === 'dark'`) is applied inline in `BaseHead.astro` before first paint; the header toggle switches the `.dark` class on `<html>`.
- Custom classes: `.label` (mono uppercase micro-labels), `.row` / `.row-title` / `.row-arrow` (hairline list rows), `.link-underline`, `.tag`, `.site-header` / `.nav-link`, `.reading-progress`, `.prose-custom` (serif article typography).
- Scroll-triggered reveals: elements with `data-reveal` get `.is-visible` via `src/scripts/reveal.ts` (IntersectionObserver, re-armed on `astro:page-load`). Optional stagger via `style="--reveal-delay: 120ms"`.

### Configuration and data

- `src/data/site.json` — Site title, description, author, URL. Imported and re-exported by `src/consts.ts` as `SITE_TITLE`, `SITE_DESCRIPTION`, `AUTHOR`, `SITE_URL`, plus `NAV_LINKS`.
- `src/data/socials.json` / `src/data/socials.ts` — Social links. The JSON is written by the admin server; the TS module is what components import.
- `astro.config.mjs` — `site` is set to `https://charienustc.github.io`. No `base` path is configured because the site is deployed to the repository root domain.

### Local admin server

`admin/server.mjs` is a minimal Node HTTP server:

- Serves `admin/public/index.html`.
- Provides a JSON REST API for CRUD on posts/projects, editing socials/site config, and publishing.
- Publishing runs `git add -A`, `git commit`, and `git push` from the repo root.
- Runs on `127.0.0.1` only; port defaults to `4322` and can be overridden with `ADMIN_PORT`.

### Deployment

`.github/workflows/deploy.yml` builds and deploys to GitHub Pages on every push to `main` or manual dispatch. It uses `pnpm install --frozen-lockfile` with `PNPM_ALLOW_BUILD_SCRIPTS: 'true'` so esbuild platform binaries can be built.

### Package/workspace notes

- `pnpm-workspace.yaml` locks `postcss` to `8.5.15` and lists `esbuild` under `onlyBuiltDependencies`. Do not remove these without verifying CI still passes.
- Analytics (Busuanzi) are only loaded in production builds, not in dev.
