---
name: infographic-syntax-creator
description: Generate AntV Infographic DSL from supplied content with template selection, structured data and theme. Use for syntax-only output or infographic Markdown fences in blog posts; do not use for AntV library component development.
---

# Infographic Syntax Creator

## Repository scope

For this blog, verify template availability against the installed `@antv/infographic` version; the reference catalog is not a guarantee for every installed version. A syntax-only request still returns the single plain block below. When inserting into an article, wrap the same DSL in an `infographic` Markdown fence, following docs/syntax-reference.md. Do not rewrite site configuration or generate a standalone HTML file unless requested.


## Overview

Generate AntV Infographic syntax output from user content, following the rules in `references/prompt.md`.

## Workflow

1. Read `references/prompt.md` for syntax rules, templates, and output constraints.
2. Extract the user's key structure: title, desc, items, hierarchy, metrics; infer missing pieces if needed.
3. Select a template that matches the structure (sequence/list/compare/hierarchy/chart).
4. Compose the syntax using `references/prompt.md` as the formatting baseline.
5. Preserve hard constraints in every output:
   - Output is a single `plain` code block; no extra text.
   - First line is `infographic <template-name>`.
   - Use two-space indentation; key/value pairs are `key value`; arrays use `-`.
   - Compare templates (`compare-*`) must have exactly two root nodes with children.
