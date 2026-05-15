/**
 * Bepaalt het heading-pad voor een DOM node binnen een gerenderde markdown viewer.
 * Loopt door alle voorgaande heading siblings/ancestors en bouwt een hiërarchisch pad.
 */
export function getHeadingPath(node: Node, root: HTMLElement): string[] {
  const headings: { level: number; text: string }[] = [];
  const allHeadings = Array.from(root.querySelectorAll('h1, h2, h3, h4, h5, h6')) as HTMLElement[];

  const targetElement = node.nodeType === Node.ELEMENT_NODE
    ? node as HTMLElement
    : node.parentElement;
  if (!targetElement) return [];

  for (const heading of allHeadings) {
    const position = heading.compareDocumentPosition(targetElement);
    const isBefore = (position & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
      || heading === targetElement
      || heading.contains(targetElement);
    if (!isBefore) continue;
    if (heading === targetElement || heading.contains(targetElement)) continue;

    const level = parseInt(heading.tagName.charAt(1), 10);
    const text = heading.textContent?.trim() || '';

    while (headings.length > 0 && headings[headings.length - 1].level >= level) {
      headings.pop();
    }
    headings.push({ level, text });
  }

  return headings.map(h => h.text);
}
