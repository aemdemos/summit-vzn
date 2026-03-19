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
 * Strategy: explicit desktop source > default source > convert mobile to desktop > img src
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
  // Extract background image from picture element — prefer desktop URL
  const picture = element.querySelector('picture');
  let heroImage = null;

  if (picture) {
    const result = extractDesktopImageUrl(picture);
    if (result) {
      heroImage = document.createElement('img');
      heroImage.src = normalizeImageUrl(result.url);
      heroImage.alt = result.alt;
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
