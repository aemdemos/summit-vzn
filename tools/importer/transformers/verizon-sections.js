/* eslint-disable */
/* global WebImporter */

/**
 * Transformer: Verizon section breaks and section-metadata.
 * Processes sections from payload.template.sections in reverse order.
 * Adds <hr> before each non-first section and Section Metadata blocks for styled sections.
 * Selectors from captured DOM (migration-work/cleaned.html).
 *
 * Note: This transformer handles section structure only (section breaks and style metadata).
 * Image URL normalization is handled by import-homepage.js steps 6b-6c.
 * See the "Verizon Image Pipeline" comment block in import-homepage.js.
 */
const TransformHook = { beforeTransform: 'beforeTransform', afterTransform: 'afterTransform' };

export default function transform(hookName, element, payload) {
  if (hookName === TransformHook.afterTransform) {
    const { template } = payload;
    if (!template || !template.sections || template.sections.length < 2) return;

    const { document } = element.ownerDocument ? { document: element.ownerDocument } : { document: element.getRootNode() };
    const sections = template.sections;

    // Process sections in reverse order to avoid DOM position shifts
    for (let i = sections.length - 1; i >= 0; i--) {
      const section = sections[i];
      // Try selector as string or array of selectors
      const selectors = Array.isArray(section.selector) ? section.selector : [section.selector];
      let sectionEl = null;
      for (const sel of selectors) {
        try {
          sectionEl = element.querySelector(sel);
        } catch (e) {
          // selector may not match, try next
        }
        if (sectionEl) break;
      }

      if (!sectionEl) continue;

      // Add Section Metadata block if section has a style
      if (section.style) {
        const metadataBlock = WebImporter.Blocks.createBlock(document, {
          name: 'Section Metadata',
          cells: { style: section.style },
        });
        sectionEl.after(metadataBlock);
      }

      // Add <hr> before each section except the first
      if (i > 0) {
        const hr = document.createElement('hr');
        sectionEl.before(hr);
      }
    }
  }
}
