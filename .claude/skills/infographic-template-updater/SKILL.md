---
name: infographic-template-updater
description: Synchronize AntV Infographic template catalogs after an explicit library-template change in a supplied source checkout. Not a routine blog-writing task; this blog has no AntV src/templates or gallery source tree.
---

# Infographic Template Updater

## Repository scope

The paths below belong to the upstream AntV library/site, not this blog. This checkout stores skills under `.claude/skills/`, not `.skills/`, and has no `src/templates` or `site/src/components/AIPlayground`. Verify the target source repository first. Do not create missing upstream paths or update catalogs merely because a blog post uses a template. Only claim a template is available after checking the installed package; frontend and CMS package versions differ.


## Overview

Update public template lists and gallery mappings when new templates are added in `src/templates`.

## Workflow

1. Collect new template names from the added `src/templates/*.ts` file (object keys).
   - If templates are composed via spreads (e.g. `...listZigzagTemplates`), also confirm the final keys in `src/templates/built-in.ts`.
2. Update template lists:
   - `.skills/infographic-creator/SKILL.md` in the "Available Templates" list.
   - `site/src/components/AIPlayground/Prompt.ts` in the template list.
   - `.skills/infographic-syntax-creator/references/prompt.md` in the template list.
   Keep existing ordering/grouping; add new `list-*` entries near other list templates.
3. Sanity check with `rg -n "<template-name>"` across the above files to confirm presence.

## Notes

- Do not remove or rename existing entries.
- Keep template names exact and lower-case.
- If a template needs example data, update or extend `site/src/components/Gallery/datasets.ts` to match its structure.
