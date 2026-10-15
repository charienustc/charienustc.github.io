---
name: infographic-item-creator
description: Generate or update AntV Infographic library Item components when a library source checkout or an explicit custom-component task is provided. Not for ordinary blog infographic DSL; this blog does not contain src/designs/items.
---

# Infographic Item Generator

## Repository scope

This is an AntV library-development reference, not a claim that this blog contains `src/designs/items`. Verify the target checkout and installed API before applying it. For ordinary article diagrams use the existing infographic fence and the syntax skill; do not create an AntV library tree inside the blog. Read root AGENTS.md and docs/syntax-reference.md before any repository edits.


## Overview

Generate complete Item component code for the infographic framework, following the project's item rules, layout constraints, and registration requirements.

## Workflow

1. Read `references/item-prompt.md` for the full framework rules, allowed components, and output requirements.
2. Clarify minimal requirements if missing: desired visuals, required fields (icon/label/value/desc/illus), sizing, and alignment needs.
3. Use `getItemProps` to extract custom props and compute layout with `getElementBounds`.
4. Produce a full TypeScript file: imports, Props extends BaseItemProps, component implementation, and `registerItem` with accurate `composites`.
5. Self-check against the constraints in the reference (no unlisted components, indexes passed to all wrapped components, correct conditional rendering).

## Notes

- Prefer scanning `src/designs/items` for similar items to match local patterns when appropriate.
- Keep output concise; avoid React-only features (keys, hooks).
