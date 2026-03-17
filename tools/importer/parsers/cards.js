/* eslint-disable */
/* global WebImporter */

/**
 * Parser for cards block.
 * Base: cards. Source: https://www.verizon.com/
 *
 * The import framework calls this parser once per matched element.
 * Each call receives a single card element, so we extract one card row.
 *
 * Handles 4 card pattern variations:
 * 1. Hero secondary tiles (.vui:cmp-marqueelayout__tile-2, __tile-3): picture(source[srcset]) + h2 + p + CTA
 * 2. Deals tiles (.vui:fed__deals-tile): picture(source[srcset]) + h3 + p + stretched anchor
 * 3. Service tiles (.vui:cmp-previewtiles__tile): img[src] + h3 + p + CTA button
 * 4. Category tilettes (.vui:cmp-categorytilettes__tilette): picture(img[src]) + anchor text
 *
 * Image extraction: Verizon uses <source srcset> for some images; <img> often has no src.
 * We try img src first, then extract from source srcset.
 *
 * Target structure (from block library):
 * 2 columns per row: [image | text content (heading + description + CTA)]
 */
export default function parse(element, { document }) {
  // Extract image - handle both <source srcset> and <img src> patterns
  const picture = element.querySelector('picture');
  const standaloneImg = element.querySelector('img');
  let imageEl = null;

  if (picture) {
    const source = picture.querySelector('source[srcset]');
    const img = picture.querySelector('img');
    const imgSrc = img?.getAttribute('src')
      || (source && source.getAttribute('srcset')?.split(',')[0]?.trim()?.split(' ')[0])
      || img?.src;

    if (imgSrc) {
      imageEl = document.createElement('img');
      imageEl.src = imgSrc;
      imageEl.alt = img?.alt || '';
    }
  } else if (standaloneImg && (standaloneImg.getAttribute('src') || standaloneImg.src)) {
    imageEl = document.createElement('img');
    imageEl.src = standaloneImg.getAttribute('src') || standaloneImg.src;
    imageEl.alt = standaloneImg.alt || '';
  }

  // Extract heading
  const heading = element.querySelector('h1, h2, h3, h4');

  // Extract description paragraphs (skip tooltip content)
  const descriptions = Array.from(element.querySelectorAll('p')).filter((p) => {
    return !p.closest('[class*="tooltip"]');
  });

  // Extract CTA link - try multiple patterns from the different card variants
  const ctaLink = element.querySelector(
    'a[class*="vui:button"], a[class*="tile__anchor"], a[class*="categorytilettes__anchor"], a[class*="previewtiles__button"]'
  );

  // Build text content cell (column 2)
  const textDiv = document.createElement('div');

  if (heading) {
    textDiv.append(heading);
  } else if (ctaLink && ctaLink.textContent.trim()) {
    // Category tilettes: the anchor text acts as the title
    const h = document.createElement('h3');
    h.textContent = ctaLink.textContent.trim();
    textDiv.append(h);
  }

  descriptions.forEach((desc) => {
    if (desc.textContent.trim()) {
      textDiv.append(desc);
    }
  });

  if (ctaLink && ctaLink.href) {
    const p = document.createElement('p');
    const a = document.createElement('a');
    a.href = ctaLink.href;
    // Use visible text, fallback to heading text for deals (stretched anchor has no text)
    const linkText = ctaLink.textContent.trim();
    if (linkText) {
      a.textContent = linkText;
    } else if (heading) {
      a.textContent = heading.textContent.trim();
    } else {
      a.textContent = 'Learn more';
    }
    p.append(a);
    textDiv.append(p);
  }

  // Build cells: [image | text content] - single row
  const cells = [];
  if (imageEl && textDiv.childNodes.length > 0) {
    cells.push([imageEl, textDiv]);
  } else if (textDiv.childNodes.length > 0) {
    cells.push([document.createTextNode(''), textDiv]);
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'cards', cells });
  element.replaceWith(block);
}
