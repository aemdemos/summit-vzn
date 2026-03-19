import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation, getBlockId } from '../../scripts/scripts.js';
import { createCard } from '../card/card.js';

/**
 * Returns the active variant options on the block.
 * @param {Element} block
 * @returns {string[]}
 */
function getOptions(block) {
  return [...block.classList].filter((c) => !['block', 'cards'].includes(c));
}

/**
 * Makes a card clickable via its first anchor link.
 * @param {Element} card
 */
function makeClickable(card) {
  const link = card.querySelector('a[href]');
  if (link) {
    card.style.cursor = 'pointer';
    card.addEventListener('click', (e) => {
      if (!e.target.closest('a')) link.click();
    });
  }
}

/**
 * Restructures a previewtiles card: head (title+desc) at top, foot (CTA+icon) at bottom.
 * @param {Element} card
 */
function decoratePreviewTile(card) {
  const body = card.querySelector('.cards-card-body');
  const imageDiv = card.querySelector('.cards-card-image');

  if (!body) return;

  const head = document.createElement('div');
  head.className = 'previewtiles-head';

  const heading = body.querySelector('h1, h2, h3, h4, h5, h6');
  const desc = body.querySelector('p');
  if (heading) head.append(heading);
  if (desc) head.append(desc);

  const foot = document.createElement('div');
  foot.className = 'previewtiles-foot';

  const link = body.querySelector('a[href]');
  if (link) {
    const btnWrap = document.createElement('div');
    btnWrap.className = 'previewtiles-button-wrap';
    link.classList.add('button', 'primary');
    const p = link.closest('p');
    if (p) {
      p.className = 'button-wrapper';
      btnWrap.append(p);
    } else {
      btnWrap.append(link);
    }
    foot.append(btnWrap);
  }

  if (imageDiv) {
    imageDiv.className = 'previewtiles-icon';
    foot.append(imageDiv);
  }

  body.textContent = '';
  body.append(head, foot);
}

/**
 * Resolves a human-readable label for a cards variant.
 * @param {string[]} options
 * @returns {string}
 */
function getVariantLabel(options) {
  if (options.includes('hero-marquee')) return 'Hero marquee';
  if (options.includes('deals-discounts')) return 'Deals and discounts';
  if (options.includes('previewtiles')) return 'Preview tiles';
  if (options.includes('categorytilettes')) return 'Category tiles';
  return 'Cards';
}

/**
 * Picks the optimised image width based on card variant.
 * @param {string[]} options
 * @returns {string}
 */
function getImageWidth(options) {
  if (options.includes('categorytilettes')) return '400';
  if (options.includes('previewtiles')) return '200';
  return '750';
}

export default function decorate(block) {
  const options = getOptions(block);

  const blockId = getBlockId('cards');
  block.setAttribute('id', blockId);
  block.setAttribute('aria-label', `${getVariantLabel(options)} for ${blockId}`);
  block.setAttribute('role', 'region');

  /* change to ul, li */
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const card = createCard(row);

    /* variant-specific per-card decoration */
    if (options.includes('previewtiles')) {
      decoratePreviewTile(card);
    }

    /* make cards clickable for interactive variants */
    if (options.includes('hero-marquee')
      || options.includes('deals-discounts')
      || options.includes('categorytilettes')
      || options.includes('previewtiles')) {
      makeClickable(card);
    }

    ul.append(card);
  });

  /* optimise local images */
  const imgWidth = getImageWidth(options);
  ul.querySelectorAll('picture > img').forEach((img) => {
    // Skip external images — AEM optimisation only works on same-origin assets
    if (img.src && img.src.startsWith('http')) {
      const imgOrigin = new URL(img.src).origin;
      if (imgOrigin !== window.location.origin) return;
    }
    const optimizedPic = createOptimizedPicture(img.src, img.alt, false, [{ width: imgWidth }]);
    moveInstrumentation(img, optimizedPic.querySelector('img'));
    img.closest('picture').replaceWith(optimizedPic);
  });

  block.textContent = '';
  block.append(ul);
}
