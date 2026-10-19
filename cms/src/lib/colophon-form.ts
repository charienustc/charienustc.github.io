/**
 * Pure helpers for the colophon selector in the frontmatter sidebar.
 *
 * The selector manages dictionary marks by id, but frontmatter may also carry
 * per-post notes and one-off marks it cannot edit. Those entries are preserved
 * verbatim whenever a dictionary mark is toggled.
 */

import type { ColophonEntry, ColophonSiteConfig } from '@/types';

export interface ColophonChoice {
  id: string;
  label: string;
  description?: string;
  icon: string;
}

export interface ColophonChoiceGroup {
  id: string;
  label: string;
  exclusive: boolean;
  choices: ColophonChoice[];
}

/** Dictionary ids currently selected; one-off marks have no id and are skipped. */
export function extractColophonIds(entries: readonly ColophonEntry[] | undefined): string[] {
  if (!entries) return [];
  return entries.flatMap((entry) => {
    if (typeof entry === 'string') return [entry];
    if ('id' in entry) return [entry.id];
    return [];
  });
}

/**
 * Rebuild the frontmatter list from the selected ids, keeping each selected
 * id's original object entry (so its note survives) and appending one-off
 * marks unchanged.
 */
export function mergeColophonEntries(
  selectedIds: readonly string[],
  originalEntries: readonly ColophonEntry[] | undefined,
): ColophonEntry[] {
  const originalById = new Map<string, ColophonEntry>();
  const oneOff: ColophonEntry[] = [];

  for (const entry of originalEntries ?? []) {
    if (typeof entry === 'string') {
      originalById.set(entry, entry);
    } else if ('id' in entry) {
      originalById.set(entry.id, entry);
    } else {
      oneOff.push(entry);
    }
  }

  return [...selectedIds.map((id) => originalById.get(id) ?? id), ...oneOff];
}

/**
 * Toggle a mark. `exclusiveSiblingIds` are the other marks in an exclusive
 * group; selecting this mark replaces them.
 */
export function toggleColophonMark(
  selectedIds: readonly string[],
  markId: string,
  exclusiveSiblingIds: readonly string[] = [],
): string[] {
  if (selectedIds.includes(markId)) {
    return selectedIds.filter((id) => id !== markId);
  }
  if (exclusiveSiblingIds.length === 0) {
    return [...selectedIds, markId];
  }
  const siblings = new Set(exclusiveSiblingIds);
  return [...selectedIds.filter((id) => !siblings.has(id)), markId];
}

/** Shape the raw site.yaml dictionary into groups the sidebar can render. */
export function buildColophonGroups(config: ColophonSiteConfig | null | undefined): ColophonChoiceGroup[] {
  if (!config || config.enabled === false || !config.marks) return [];

  const groups: ColophonChoiceGroup[] = Object.entries(config.groups ?? {}).map(([id, group]) => ({
    id,
    label: group.label,
    exclusive: group.exclusive ?? false,
    choices: [],
  }));
  const groupById = new Map(groups.map((group) => [group.id, group]));
  const ungrouped: ColophonChoiceGroup = { id: '__ungrouped__', label: 'Other', exclusive: false, choices: [] };

  for (const [id, mark] of Object.entries(config.marks)) {
    const choice: ColophonChoice = {
      id,
      label: mark.label,
      description: mark.description,
      icon: mark.icon,
    };
    const group = mark.group ? groupById.get(mark.group) : undefined;
    (group ?? ungrouped).choices.push(choice);
  }

  return [...groups, ungrouped].filter((group) => group.choices.length > 0);
}
