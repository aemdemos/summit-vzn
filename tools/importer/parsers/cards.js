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
 *
 * IMAGE HANDLING NOTE:
 * Parser-level image normalization (normalizeImageUrl, extractDesktopImageUrl) is
 * best-effort only. The WebImporter framework reconstructs <picture> elements from
 * the original DOM during serialization, overriding parser output. The definitive
 * image pipeline runs in import-homepage.js steps 6b-6c (post-transform), which:
 *   - Promotes desktop <source srcset> URL to <img src>
 *   - Strips all <source> elements (DA ignores them, and they cause case-sensitivity bugs)
 *   - Normalizes fmt=webp-alpha → fmt=webp and ensures scl= param is present
 * See import-homepage.js "Verizon Image Pipeline" comment block for full details.
 */
/**
 * Normalize Verizon Scene7 image URLs:
 * - Replace webp-alpha with webp (DA cannot process webp-alpha format)
 * - Ensure scl=2 for consistent Scene7 query string format
 *
 * Note: This normalization may be overridden by the WebImporter framework during
 * <picture> reconstruction. The post-transform pipeline in import-homepage.js
 * (steps 6b-6c) is the authoritative normalization pass.
 */
function normalizeImageUrl(url) {
  if (!url) return url;
  try {
    const u = new URL(url, 'https://ss7.vzw.com');
    const fmt = u.searchParams.get('fmt');
    if (fmt === 'webp-alpha') {
      u.searchParams.set('fmt', 'webp');
    }
    if (!u.searchParams.has('scl')) {
      u.searchParams.set('scl', '2');
    }
    return u.toString();
  } catch (e) {
    return url.replace('fmt=webp-alpha', 'fmt=webp');
  }
}

/**
 * Convert a Verizon CDN URL from mobile/tablet variant to desktop.
 * Verizon uses suffixes: -m (mobile), -t (tablet), -d (desktop) before the query string.
 */
function convertToDesktopUrl(url) {
  if (url && url.includes('vzw.com/is/image/')) {
    return url.replace(/([-_])([mt])(\?|$)/, '$1d$3');
  }
  return url;
}

/**
 * Extract the first URL from a srcset attribute value.
 */
function firstSrcsetUrl(srcset) {
  return srcset?.split(',')[0]?.trim()?.split(' ')[0] || null;
}

/**
 * Extract the best (desktop) image URL from a picture element.
 *
 * Verizon uses different <source> patterns across sections:
 * - Deals tiles: <source media="(min-width: 990px)"> = desktop URL (first source)
 * - Category tilettes: <source media="(max-width: 1023px)"> = mobile, <source> (no media) = desktop
 * - Hero marquee tiles: <source media="(min-width: 325px)"> = mobile only, no desktop source
 *
 * Strategy:
 * 1. Find <source> with min-width >= 900px (explicit desktop breakpoint)
 * 2. Find <source> without media attribute (default = desktop)
 * 3. Use any available URL but convert mobile suffix (-m) to desktop (-d)
 * 4. Fall back to <img src>
 */
function extractDesktopImageUrl(picture) {
  const sources = Array.from(picture.querySelectorAll('source[srcset]'));
  const img = picture.querySelector('img');
  const alt = img?.alt || '';

  // 1. Explicit desktop source (min-width >= 900px)
  for (const source of sources) {
    const media = source.getAttribute('media') || '';
    const match = media.match(/min-width:\s*(\d+)px/);
    if (match && parseInt(match[1], 10) >= 900) {
      const url = firstSrcsetUrl(source.getAttribute('srcset'));
      if (url) return { url, alt };
    }
  }

  // 2. Default source (no media query = shown on desktop)
  for (const source of sources) {
    if (!source.getAttribute('media')) {
      const url = firstSrcsetUrl(source.getAttribute('srcset'));
      if (url) return { url, alt };
    }
  }

  // 3. Any source URL, but convert mobile/tablet suffix to desktop
  if (sources.length > 0) {
    const url = firstSrcsetUrl(sources[0].getAttribute('srcset'));
    if (url) return { url: convertToDesktopUrl(url), alt };
  }

  // 4. Fall back to <img src>, convert to desktop
  const imgSrc = img?.getAttribute('src') || img?.src;
  if (imgSrc) return { url: convertToDesktopUrl(imgSrc), alt };

  return null;
}

export default function parse(element, { document }) {
  // Extract image - prefer desktop source, normalize URL format
  const picture = element.querySelector('picture');
  const standaloneImg = element.querySelector('img');
  let imageEl = null;

  if (picture) {
    const result = extractDesktopImageUrl(picture);
    if (result) {
      imageEl = document.createElement('img');
      imageEl.src = normalizeImageUrl(result.url);
      imageEl.alt = result.alt;
    }
  } else if (standaloneImg && (standaloneImg.getAttribute('src') || standaloneImg.src)) {
    imageEl = document.createElement('img');
    imageEl.src = normalizeImageUrl(standaloneImg.getAttribute('src') || standaloneImg.src);
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
