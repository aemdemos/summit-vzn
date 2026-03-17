/* eslint-disable */
/* global WebImporter */

/**
 * Parser for hero block.
 * Base: hero. Source: https://www.verizon.com/
 * Instances: .vui:cmp-marqueelayout__tile-1 (primary hero), .vui:cmp-marqueelayout__skinny-banner (5G banner)
 *
 * Target structure (from block library):
 * Row 1: Background image (optional) - single cell
 * Row 2: Heading + subheading + CTA links - all in single cell
 *
 * Source DOM structure:
 * - Primary hero: picture (source[srcset] + img without src), h1, p, a.vui:button
 * - Skinny banner: picture (source[srcset] + img without src), h2, a.vui:button, p
 */
export default function parse(element, { document }) {
  // Extract background image from picture element
  // Verizon uses <source srcset="..."> for images; the <img> has no src attribute.
  // Extract the first URL from the first <source srcset>.
  const picture = element.querySelector('picture');
  let heroImage = null;

  if (picture) {
    const source = picture.querySelector('source[srcset]');
    const img = picture.querySelector('img');
    const imgSrc = img?.getAttribute('src')
      || (source && source.getAttribute('srcset')?.split(',')[0]?.trim()?.split(' ')[0])
      || img?.src;

    if (imgSrc) {
      heroImage = document.createElement('img');
      heroImage.src = imgSrc;
      heroImage.alt = img?.alt || '';
    }
  }

  // Extract heading - h1 or h2
  const heading = element.querySelector('h1, h2');

  // Extract description paragraphs (not inside tooltip or disclaimer areas)
  const descriptions = Array.from(element.querySelectorAll('p')).filter((p) => {
    const isTooltip = p.closest('[class*="tooltip"]');
    const isDisclaimer = p.closest('[class*="border-top"]');
    return !isTooltip && !isDisclaimer;
  });

  // Extract CTA links - buttons/links with vui:button class
  const ctaLinks = Array.from(element.querySelectorAll('a[class*="vui:button"]'));

  // Build cells matching hero block library structure (1 column, up to 2 rows)
  const cells = [];

  // Row 1: Background image (optional) - single cell
  if (heroImage) {
    cells.push([heroImage]);
  }

  // Row 2: All content in a single cell (heading + description + CTAs)
  const contentDiv = document.createElement('div');

  if (heading) {
    contentDiv.append(heading);
  }

  descriptions.forEach((desc) => {
    if (desc.textContent.trim()) {
      contentDiv.append(desc);
    }
  });

  ctaLinks.forEach((link) => {
    const p = document.createElement('p');
    p.append(link);
    contentDiv.append(p);
  });

  if (contentDiv.childNodes.length > 0) {
    cells.push([contentDiv]);
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'hero', cells });
  element.replaceWith(block);
}
