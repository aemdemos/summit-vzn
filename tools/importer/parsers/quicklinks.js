/* eslint-disable */
/* global WebImporter */

/**
 * Parser for quicklinks block.
 * Base: quicklinks. Source: https://www.verizon.com/
 * Instance: section#quickLinks-pzn
 *
 * Source DOM structure:
 * - Each link is a slide: <div data-vui-cmp-quicklinks-link>
 *   - <a class="vui:cmp-quicklinks__anchor"> with text label
 *   - <i class="vui:cmp-quicklinks__icon" style="--vui-icon_mask-image: url('...')">
 *     (icon is a CSS mask-image on an <i> element, not an <img>)
 *
 * Target structure (EDS block table):
 * Each row = one pill link:
 * | icon image (picture) | link text (paragraph with anchor) |
 *
 * IMAGE HANDLING:
 * Icons use Scene7 CDN URLs with fmt=png-alpha or fmt=webp-alpha for transparency.
 * We normalize to fmt=png-alpha (not webp or jpeg) to preserve transparency,
 * since these are small UI icons that require alpha channel support.
 * Using scl=1 preserves native icon resolution (typically 56x56 or similar).
 */
export default function parse(element, { document }) {
  const cells = [];
  const anchors = element.querySelectorAll('a[class*="quicklinks__anchor"]');

  anchors.forEach((anchor) => {
    const text = anchor.textContent.trim();
    const href = anchor.getAttribute('href') || '';

    // Extract icon URL from the <i> element's CSS custom property
    const icon = anchor.querySelector('i[class*="icon"]');
    let iconUrl = null;
    if (icon) {
      const style = icon.getAttribute('style') || '';
      const match = style.match(/url\(['"]?(.*?)['"]?\)/);
      if (match) {
        iconUrl = match[1];
      }
    }

    // Build icon cell — use png-alpha to preserve transparency
    const iconCell = document.createElement('div');
    if (iconUrl) {
      // Normalize URL: ensure fmt=png-alpha and scl=1
      let normalizedUrl = iconUrl
        .replace(/fmt=webp-alpha/g, 'fmt=png-alpha')
        .replace(/fmt=webp/g, 'fmt=png-alpha');
      if (!normalizedUrl.includes('scl=')) {
        normalizedUrl += (normalizedUrl.includes('?') ? '&' : '?') + 'scl=1';
      }
      const img = document.createElement('img');
      img.src = normalizedUrl;
      img.alt = '';
      iconCell.append(img);
    }

    // Build link cell
    const linkCell = document.createElement('div');
    const p = document.createElement('p');
    const a = document.createElement('a');
    a.href = href;
    a.textContent = text;
    p.append(a);
    linkCell.append(p);

    cells.push([iconCell, linkCell]);
  });

  if (cells.length === 0) return;

  const block = WebImporter.Blocks.createBlock(document, { name: 'quicklinks', cells });
  element.replaceWith(block);
}
