# Repository Guidelines

## Project Structure & Module Organization

The Astro application lives in `src/`. Routes are in `src/pages/`; reusable Astro and React UI belongs in `src/components/`; layouts, hooks, utilities, Nanostores, and translations use matching directories. Blog content is under `src/content/blog/`, and static files are in `public/`. Configure the site in `config/site.yaml`. Build-time generators live in `src/scripts/`, the Koharu CLI in `scripts/`, and the standalone React/Vite CMS in `cms/`. Treat `dist/` and `.astro/` as generated output.

## Build, Test, and Development Commands

Use pnpm from the repository root:

- `pnpm install` installs application dependencies.
- `pnpm dev` starts Astro at `http://localhost:4321`.
- `pnpm build` creates the production site; `pnpm preview` serves it.
- `pnpm check` runs Astro and TypeScript validation.
- `pnpm lint` checks source with Biome; `pnpm lint:fix` applies safe fixes.
- `pnpm knip` reports unused files, exports, and dependencies.
- `pnpm cms:install && pnpm cms` installs and starts the local CMS.
- `pnpm koharu generate all` refreshes LQIP, summary, and similarity assets after relevant content changes.

## Coding Style & Naming Conventions

Biome is authoritative: two-space indentation, LF endings, 128-column lines, single quotes in JavaScript/TypeScript, semicolons, and trailing commas. Keep Tailwind classes sorted. Use PascalCase for React components (`PostCard.tsx`), `use`-prefixed camelCase for hooks (`useMediaQuery.ts`), and `index.ts` for intentional barrel exports. Prefer `.astro` for static layouts and pages; use React for interactive state. Import through aliases such as `@components/*` and `@lib/*`, and avoid circular dependencies.

## Testing Guidelines

`pnpm test` runs the full node:test suites (config, markdown, toc, diagram, motion, glide, content, migrate, moments, cms). `pnpm test:content` runs the content-collection tests alone; `pnpm test:cms` includes post-history tests. `pnpm test:moments:smoke` is for the optional dynamic suite integration. Both `pnpm check` and `pnpm --dir cms exec tsc --noEmit` must report zero errors: the former six frontend errors were fixed in `2d69e5d`. The `cms/` package remains outside root `pnpm check`. Before committing, run `pnpm lint:fix`, `pnpm test`, and `pnpm build`, plus relevant type checks. Documentation updates also need Markdown, link and source-consistency checks. Manually exercise affected routes with `pnpm dev`; CMS changes should also be verified through `pnpm cms`. Prioritize utilities, transformations, scripts, hooks and stores in tests. Use portable absolute temporary paths, not hardcoded Windows drive letters; keep capability-dependent POSIX/symlink skips explicit.

## Commit & Pull Request Guidelines

Recent history favors short imperative subjects and Conventional Commit prefixes such as `fix:`, `feat:`, and `chore:`. Work happens directly on `main` (the former `dev` branch is retired) — GitHub Pages deploys from `main`, so every commit must keep `main` releasable, and pushes happen only on explicit instruction. Keep each commit focused and include generated assets when the source change requires them. Pull requests should explain the user-visible effect, list validation commands, link related issues, and include screenshots or recordings for visual changes. Call out configuration, migration, performance, or i18n impact explicitly.

The Pages workflow installs frontend and CMS dependencies from their own lockfiles, then runs frontend types, CMS types, full tests and build before deployment. Root workspace installation does not install CMS dependencies. Local CMS Publish stages all worktree changes, runs lint-staged, then commits and pushes the current upstream branch; it is not a substitute for the full CI gate. Commit-only requests do not authorize push.

## Configuration & Generated Data

Do not commit secrets from `.env`. Restart the dev server after changing `config/site.yaml`. Preserve the tracked `.cache/og-data.json`; it is an intentional build cache, unlike other ignored cache artifacts. Visitor analytics run through the built-in Umami integration (`analytics.umami` in `config/site.yaml`); the optional `statistics_display` share token is read-only and safe to commit.

## Current Feature Boundaries

Verified 2026-10-15. Start with [docs/README.md](docs/README.md); [CLAUDE.md](CLAUDE.md) supplements these shared instructions.

Repository-local `.claude/skills/` includes the blog-writing guide and AntV references. Blog writing must read the current site.yaml categoryMap; AntV item/structure/template references target library source checkouts, not nonexistent blog src/designs or src/templates directories.

- `src/content.config.ts` defines both blog and static moments. Categories come from frontmatter, dates use site timezone, and production filters drafts. `/posts` is month-grouped; `/moments` is the static year-grouped feed. Homepage LatestActivity shows the latest regular post and visible moment.
- `moments.enabled: false` controls optional dynamic koharu-suite routes, not the static collection. Keep static GitHub Pages deployment; activating suite requires a separate Node deployment and route-collision review.
- Configuration flows from `config/site.yaml` through `src/lib/config/site.ts`; `src/lib/**` must not import the `src/constants/site-config.ts` assembly layer.
- Preserve `client:panel` / `client:content` loading, TOC media/visible hydration and drawer tracking gates, deferred comment SDKs and nearby Mermaid rendering. Fullscreen viewers still use `client:idle`; do not describe unported upstream features as landed.
- Post history lives under `backups/versions/posts/`; moments retain their existing `backups/versions/` paths. Restores must validate post/version ownership, reject traversal/symlinks, back up before overwrite and block unsaved editor changes. Preserve these local gitignored backups. See [CMS guide](docs/features/cms.md).
- Announcements use unique IDs and plain text; supported types are `info`, `success`, `warning`, `important`. Dismissal is not marking read. See [announcement guide](docs/features/announcements.md).
- Keep docs aligned with actual code. Historical upgrade records and optional deployment references must stay explicitly scoped; do not rewrite blog content or personal profile pages as part of documentation maintenance.
