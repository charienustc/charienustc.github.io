---
name: infographic-structure-creator
description: Generate or update AntV Infographic library Structure components when the user provides a library checkout or explicitly requests custom structure code. Not for ordinary blog diagrams; this blog has no src/designs/structures source tree.
---

# Infographic Structure Creator

## Repository scope

This skill targets AntV framework development. The current blog consumes `@antv/infographic` and does not contain `src/designs/structures`. Use the existing blog renderer and syntax skill for content work. Apply the reference only after identifying the actual library checkout or explicit custom integration target; do not create library directories or edit dependencies implicitly.


## Overview

Generate complete Structure component code for the infographic framework, following the project's component rules, layout constraints, and registration requirements.

## Workflow

1. Read `references/structure-prompt.md` for the full framework rules, allowed components, and output requirements.
2. Clarify minimal requirements if missing: structure category, layout direction, hierarchy depth, and whether add/remove buttons are needed.
3. Choose Item vs Items, compute layout from `getElementBounds`, and plan decor elements under ItemsGroup.
4. Produce a full TypeScript file: imports, Props extends BaseStructureProps, component implementation, and `registerStructure` with accurate `composites`.
5. Self-check against the constraints in the reference (no unlisted components, no SVG cx/cy/r, correct indexes, empty-state handling).

## Notes

- Prefer scanning `src/designs/structures` for similar existing structures to match local patterns when appropriate.
- Keep output concise; avoid React-only features (keys, hooks).
