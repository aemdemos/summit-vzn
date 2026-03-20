/* eslint-disable */
/* global WebImporter */

/**
 * Transformer: Verizon site-wide cleanup.
 * Selectors from captured DOM (migration-work/cleaned.html).
 * Removes non-authorable content: header, footer, quick links nav,
 * tooltips, cookie/consent elements, tracking attributes.
 *
 * Note: Image URL normalization (desktop promotion, webp-alpha fix, scl= param)
 * is handled by import-homepage.js steps 6b-6c, not by this transformer.
 * See the "Verizon Image Pipeline" comment block in import-homepage.js.
 */
const TransformHook = { beforeTransform: 'beforeTransform', afterTransform: 'afterTransform' };

export default function transform(hookName, element, payload) {
  if (hookName === TransformHook.beforeTransform) {
    // Remove tooltip buttons (info icons that trigger popups) - found in hero tiles and deal cards
    WebImporter.DOMUtils.remove(element, [
      '.vui\\:tooltip__trigger-wrap',
      'button.vui\\:tooltip__trigger',
    ]);

    // Remove hidden overflow that may affect parsing
    element.querySelectorAll('[style*="overflow: hidden"]').forEach((el) => {
      el.style.overflow = '';
    });
  }

  if (hookName === TransformHook.afterTransform) {
    // Remove non-authorable content from captured DOM
    WebImporter.DOMUtils.remove(element, [
      // Header navigation - <header id="vz-gh20">
      'header#vz-gh20',
      'header',
      // Footer - <footer id="vz-gf20">
      'footer#vz-gf20',
      'footer',
      // Script/tracking elements
      'script',
      'noscript',
      'link',
      'iframe',
      // Evolv experimentation overlay
      '[class*="evolv"]',
    ]);

    // Remove tracking pixel images (1x1 gifs, beacons from ad/analytics services)
    element.querySelectorAll('img').forEach((img) => {
      const src = img.getAttribute('src') || '';
      if (src.includes('innovid.com')
        || src.includes('bat.bing.com')
        || src.includes('analytics.twitter.com')
        || src.includes('t.co/')
        || src.includes('1x1.gif')
        || src.includes('doubleclick.net')
        || src.includes('facebook.com/tr')
        || src.includes('qualtrics.com')) {
        img.remove();
      }
    });

    // Remove empty paragraphs left after tracking pixel removal
    element.querySelectorAll('p').forEach((p) => {
      if (!p.textContent.trim() && !p.querySelector('img, a, picture')) {
        p.remove();
      }
    });

    // Remove "Show more deals" button text (non-functional in EDS)
    element.querySelectorAll('button, [class*="show-more"]').forEach((el) => {
      if (el.textContent.trim().toLowerCase().includes('show more')) {
        el.remove();
      }
    });

    // Clean tracking/data attributes
    element.querySelectorAll('*').forEach((el) => {
      el.removeAttribute('data-track');
      el.removeAttribute('data-sitecat-cta');
      el.removeAttribute('data-sitecat-level');
      el.removeAttribute('data-sitecat-position');
      el.removeAttribute('onclick');
    });
  }
}
