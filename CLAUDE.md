# CLAUDE.md

Repository guidance for Claude Code. Last verified: 2026-10-15.
Read [AGENTS.md](AGENTS.md) first; it is the shared repository policy. This file provides implementation context, not a separate deployment workflow.

## Current project

Charien's Yard is a customized astro-koharu blog, using Astro 7, React 19, Tailwind CSS 4, Nanostores and static Pagefind search.
The package version remains 6.3.0; this does not mean Astro 6 or a complete upstream v7 merge.
The default deployment is GitHub Pages from `main`. The CMS is a separate local React/Vite + Hono application and is never part of the Pages runtime.

- Start with [docs/README.md](docs/README.md), [README.md](README.md) and [GETTING-STARTED.md](GETTING-STARTED.md).
- For changes to architecture or behavior, update the relevant guide and these agent instructions within the authorized task.
- Inspect the actual files before relying on older teaching snippets in `docs/overview/`.
- Preserve unrelated working-tree edits, content, generated assets and local backups.
- `.claude/skills/blog-writer/` follows current frontmatter and categoryMap rules. AntV item/structure/template skills are conditional library-development references; do not create upstream library paths inside this blog.

## Engineering rules

- Keep modules focused, with explicit props, exported types and intentional `index.ts` barrels.
- Prefer pure functions; isolate file, network and framework side effects at boundaries.
- Reuse existing utilities and hooks; avoid premature abstractions and circular dependencies.
- Module limits: maximum three nesting levels, 500 lines per file, 15 public exports and 10 imports per module. Plan focused new modules rather than unrelated rewrites of existing large files.
- Use `.astro` for static layouts and `.tsx` for interactive state. Follow Biome: two spaces, LF, single quotes, semicolons, trailing commas, 128 columns and sorted Tailwind classes.
- Do not add a dependency for a simple existing capability. URL state uses native URLSearchParams; nuqs is not an installed project dependency.

## Commands and verification

Use pnpm 10.28.2 with Node.js ≥ 22.20.0 from the repository root.

```bash
pnpm dev
pnpm cms:install
pnpm cms
pnpm lint:fix
pnpm check
pnpm --dir cms exec tsc --noEmit
pnpm test
pnpm build
```

Both type checks must report zero errors. The former six errors in tar.ts and SearchPortal.astro were fixed in `2d69e5d`; never use that obsolete allowance.
CMS dependencies and its lockfile are independent; CI installs them with `pnpm --dir cms install --ignore-workspace --frozen-lockfile`.
Before committing, run lint:fix, tests and build; exercise affected UI in dev/CMS. Tests of paths must use portable absolute temporary roots, not hardcoded Windows drive letters.
Keep capability-dependent POSIX/symlink skips explicit; do not skip real functionality just to make CI green.
`pnpm knip` is useful for targeted dependency audits, not a reason to delete unrelated code.

GitHub Actions runs frontend types → CMS types → tests → build → Pages deployment. Local lint-staged alone does not provide this guarantee.
Work on `main`; commit and push only as requested. A request to commit is not a request to push. Do not merge/rebase or publish unrelated work.

## Configuration and dependencies

- Edit `config/site.yaml`; restart dev after YAML changes. Content translations are in `config/i18n-content.yaml`.
- `src/lib/config/site.ts` owns normalized configuration; section-specific `normalize*` functions live in `src/lib/config/`.
- `src/constants/site-config.ts` is the assembly/compatibility layer. `src/lib/**` must not import it; depend on `@lib/config/*` instead.
- Root aliases point at `src/`; the CMS's `@/` points at `cms/src/`. Do not mix these type-check contexts.
- Styles start at `src/styles/index.css`; Tailwind 4 imports and @config are in `src/styles/global/tailwind.css`, with `tailwind.config.mjs` retained.
- Preserve tracked `.cache/og-data.json`; do not commit `.env`, model caches or backups.

## Content and routes

`src/content.config.ts` defines both `blog` and static `moments` through glob loaders. Dates use the configured site timezone, independent of CI timezone.
Drafts are visible in development and filtered in production. Categories come from frontmatter; category URL mappings come from site.yaml.
Keep existing `link` values stable; use the migration CLI for historical slugs rather than guessing new public URLs.

The homepage shows latest activity (latest regular post + latest visible moment), series/sticky posts and five regular posts.
`/posts` is a single month-grouped index, not `/posts/2` pagination. `/moments` is a static, year-grouped feed with no per-item detail page or dedicated RSS/search.
`moments.enabled: false` disables the optional dynamic suite integration, not the static feed. Never enable suite or claim SSR deployment is required for the existing local collection.

Default-language URLs have no prefix; non-default locales use `[lang]` mirrors. Use `_shared/routes.ts`, `localePaths` and explicit locale props.
The route mirror assertion guards coverage. Do not enable Astro fallback: it conflicts with the series route.
UI dictionaries live under `src/i18n/translations/`; translated articles are under `src/content/blog/<locale>/`.

## Hydration and interaction

- BGM and announcement list use `client:panel`, registered in astro.config.mjs, with `src/lib/client-panel.ts` as the loader.
- ContentEnhancer uses `client:content` from `src/lib/markdown/client-content.ts`.
- Desktop TOC uses `client:media`; the drawer uses `client:visible` and `isDrawer`. Preserve mobile/open-state scroll gates.
- Comment SDKs and Mermaid rendering defer until near their content. Pagefind's expensive bundle imports when search opens.
- The three fullscreen viewers still mount with `client:idle`; upstream lazy viewer consolidation is not implemented locally.
- Initialize DOM enhancements on `astro:page-load`, handle already-ready DOM, and clean up on page swap. Enhance every `.custom-content` block, including moments feeds.
- Do not serialize full article bodies into island props unnecessarily. Measure performance changes; do not assume an upstream optimization is already applied.

## CMS versions and publishing

Read [CMS guide](docs/features/cms.md) before changing persistence.

- Post saves retain old raw Markdown in `backups/versions/posts/`; moments keep `backups/versions/` compatibility.
- `post-versions.ts` owns path checks, exclusive backup creation, listing, reads and reversible restores. Routes live in `api/versions.ts`.
- Every read/restore specifies postId and version. Reject cross-post versions, traversal and symlinks.
- Backup failure must stop overwrite. Restores retain current disk content first and reload the editor after success.
- Unsaved editor content blocks restoration. The history UI shows raw Markdown with frontmatter, not a rendered diff.
- Toggle-draft/sticky endpoints and manual file edits do not create history; do not claim universal autosave or Git history import.
- History is local and gitignored. Do not delete backups as cleanup, upload them, or treat them as remote disaster recovery.
- Publish stages the entire working tree, runs lint-staged and commits/pushes the current upstream branch. Inspect unrelated edits before invoking it.
- The server checks localhost Host and optional CMS_API_KEY, but is not a public authenticated CMS.

## Announcements and optional services

Announcements are plain-text YAML entries with unique IDs; types are info/success/warning/important (not error).
Unread valid announcements use bottom-right toasts; the footer opens the full list. Dismissal alone is not marking read. Read state is browser-local.
See [announcement guide](docs/features/announcements.md) for scheduling and renewal of IDs.

Umami is configured under analytics.umami and mounted by the local UmamiAnalytics component; statistics_display is an optional public read-only share token, safe to commit.
BGM, Christmas effects, Bangumi and dynamic suite are optional; consult current YAML rather than assuming they are enabled.
