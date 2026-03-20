import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation, getBlockId } from '../../scripts/scripts.js';
import { createCard } from '../card/card.js';

const BRIGHTNESS_THRESHOLD = 110;
const SAMPLE_SIZE = 50;

/**
 * Returns the active variant options on the block.
 * @param {Element} block
 * @returns {string[]}
 */
function getOptions(block) {
  return [...block.classList].filter((c) => !['block', 'cards'].includes(c));
}

/**
 * Analyzes average perceived brightness of an image.
 * Fetches the image as a blob to bypass CORS restrictions on cross-origin CDN images,
 * draws it to an off-screen canvas at a small sample size, and calculates the
 * average luminance using the perceived brightness formula (0.299R + 0.587G + 0.114B).
 * @param {string} src - Image URL to analyze
 * @returns {Promise<number|null>} Brightness value 0–255, or null on failure
 */
async function getImageBrightness(src) {
  try {
    const resp = await fetch(src);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    const bitmap = await createImageBitmap(blob);

    const canvas = document.createElement('canvas');
    canvas.width = SAMPLE_SIZE;
    canvas.height = SAMPLE_SIZE;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    bitmap.close();

    const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    let totalBrightness = 0;
    const pixelCount = SAMPLE_SIZE * SAMPLE_SIZE;
    const len = pixelCount * 4;
    for (let i = 0; i < len; i += 4) {
      const r = data[i] || 0;
      const g = data[i + 1] || 0;
      const b = data[i + 2] || 0;
      totalBrightness += 0.299 * r + 0.587 * g + 0.114 * b;
    }
    return totalBrightness / pixelCount;
  } catch {
    return null;
  }
}

/**
 * Marks cards with dark background images so CSS can apply light text.
 * Runs brightness analysis on each card's image in parallel and adds a `dark`
 * class to any card whose image falls below the brightness threshold.
 * @param {HTMLUListElement} ul - The card list element
 */
async function applyDarkCardStyles(ul) {
  const cards = [...ul.children];
  const tasks = cards.map(async (card) => {
    const img = card.querySelector('.cards-card-image img');
    if (!img?.src) return;
    const brightness = await getImageBrightness(img.src);
    if (brightness !== null && brightness < BRIGHTNESS_THRESHOLD) {
      card.classList.add('dark');
    }
  });
  await Promise.all(tasks);
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

const VISIBLE_DEALS_COUNT = 4;

/**
 * Adds a "Show more deals" toggle to the deals-discounts grid.
 * Initially hides cards beyond the visible count; clicking the button
 * reveals all cards and hides the button, matching the Verizon.com pattern.
 * @param {Element} block - The cards block element
 * @param {HTMLUListElement} ul - The card list element
 */
function addShowMoreButton(block, ul) {
  const cards = [...ul.children];
  if (cards.length <= VISIBLE_DEALS_COUNT) return;

  cards.forEach((card, i) => {
    if (i >= VISIBLE_DEALS_COUNT) card.classList.add('hidden');
  });

  const wrap = document.createElement('div');
  wrap.className = 'deals-show-more-wrap';

  const btn = document.createElement('button');
  btn.className = 'deals-show-more';
  btn.setAttribute('aria-expanded', 'false');
  const label = document.createElement('span');
  label.textContent = 'Show more deals';
  btn.append(label);

  btn.addEventListener('click', () => {
    ul.querySelectorAll('li.hidden').forEach((card) => card.classList.remove('hidden'));
    const link = document.createElement('a');
    link.href = '/deals/';
    link.className = 'deals-show-more';
    link.textContent = 'Shop all deals';
    wrap.replaceChildren(link);
  });

  wrap.append(btn);
  block.append(wrap);
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

  if (options.includes('deals-discounts')) {
    addShowMoreButton(block, ul);
    applyDarkCardStyles(ul);
  }
}
