/**
 * Rehype plugin that wraps every table in a scrollable container.
 *
 * A table switched to `display: block` for horizontal scrolling shrink-wraps its inner
 * table box to the content width, so the header background and row borders stop short of
 * the right edge. The wrapper owns the scroll container, border and radius instead, which
 * lets the table itself keep `width: 100%` and reach the article boundary.
 */
import type { Element, Root } from 'hast';
import { visit } from 'unist-util-visit';

const WRAPPER_CLASS = 'markdown-table-wrapper';

function hasWrapperClass(node: Element): boolean {
  const className = node.properties?.class;
  if (Array.isArray(className)) return className.includes(WRAPPER_CLASS);
  return typeof className === 'string' && className.split(/\s+/).includes(WRAPPER_CLASS);
}

export function rehypeTableWrapper() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element, index, parent) => {
      if (node.tagName !== 'table') return;
      if (index === undefined || !parent) return;

      // Skip tables already wrapped (e.g., authored in raw HTML)
      if (parent.type === 'element' && hasWrapperClass(parent)) return;

      parent.children[index] = {
        type: 'element',
        tagName: 'div',
        properties: { class: WRAPPER_CLASS },
        children: [node],
      };
    });
  };
}
