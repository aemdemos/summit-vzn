/**
 * Normalises a single CSS coordinate value.
 * Keeps `%` values as-is; appends `px` when no unit is specified.
 * @param {string} raw  Raw authored value, e.g. "50%", "28px", "120"
 * @returns {string} CSS-ready value
 */
function normCoord(raw) {
  const v = raw.trim();
  if (v.endsWith('%') || v.endsWith('px')) return v;
  return `${v}px`;
}

/**
 * Extracts tooltip text (and optional position coords) from italic-only paragraphs.
 * Convention: a <p><em>text</em></p> in authored content = tooltip.
 * If text starts with "[x, y]" the icon is absolutely positioned at those coords.
 * @param {Element} contentEl The content container
 * @returns {{ text: string, coords: { left: string, top: string } | null } | null}
 */
function extractTooltip(contentEl) {
  if (!contentEl) return null;
  const paragraphs = [...contentEl.querySelectorAll('p')];
  for (let i = paragraphs.length - 1; i >= 0; i -= 1) {
    const p = paragraphs[i];
    if (p.children.length === 1 && p.children[0].tagName === 'EM') {
      let text = p.children[0].textContent.trim();
      p.remove();

      // Parse optional "[x, y]" coordinate prefix
      let coords = null;
      const coordMatch = text.match(/^\[([%\w.]+),\s*([%\w.]+)\]\s*/);
      if (coordMatch) {
        coords = { left: normCoord(coordMatch[1]), top: normCoord(coordMatch[2]) };
        text = text.slice(coordMatch[0].length).trim();
      }
      return { text, coords };
    }
  }
  return null;
}

/**
 * Positions the tooltip popup near the trigger using fixed positioning.
 * Flips below the trigger when there isn't room above.
 * @param {Element} trigger The tooltip trigger button
 * @param {Element} popup The tooltip popup element
 */
function positionPopup(trigger, popup) {
  const rect = trigger.getBoundingClientRect();
  const popupWidth = 240;
  const gap = 10;

  // Make popup briefly visible off-screen to measure its height
  popup.style.visibility = 'hidden';
  popup.style.display = 'block';
  const popupHeight = popup.offsetHeight;
  popup.style.display = '';
  popup.style.visibility = '';

  const triggerCenter = rect.left + rect.width / 2;
  let left = triggerCenter - popupWidth / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - popupWidth - 8));

  // Arrow points at the trigger center, not always at popup center
  const arrowLeft = triggerCenter - left;
  popup.style.setProperty('--arrow-left', `${arrowLeft}px`);

  const fitsAbove = rect.top - gap - popupHeight > 0;

  popup.style.left = `${left}px`;

  if (fitsAbove) {
    popup.style.top = `${rect.top - gap - popupHeight}px`;
    popup.classList.remove('below');
  } else {
    popup.style.top = `${rect.bottom + gap}px`;
    popup.classList.add('below');
  }
}

/**
 * Builds and inserts a tooltip UI into the hero content.
 * Popup is appended to body to escape overflow:hidden on the hero.
 * @param {string} text The tooltip text
 * @param {{ left: string, top: string } | null} coords Optional XY position
 * @param {Element} block The hero block element
 */
function buildTooltip(text, coords, block) {
  const contentEl = block.querySelector('.hero-content');
  if (!text || !contentEl) return;

  const wrapper = document.createElement('span');
  wrapper.className = 'tooltip-wrapper';

  const trigger = document.createElement('button');
  trigger.className = 'tooltip-trigger';
  trigger.setAttribute('type', 'button');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-label', 'More information');

  // Popup lives on the body to escape hero overflow:hidden
  const popup = document.createElement('div');
  popup.className = 'hero-tooltip-popup';
  popup.setAttribute('role', 'tooltip');
  popup.textContent = text;
  document.body.append(popup);

  wrapper.append(trigger);

  if (coords) {
    // Absolute positioning within the block
    wrapper.classList.add('tooltip-positioned');
    wrapper.style.left = coords.left;
    wrapper.style.top = coords.top;
    block.append(wrapper);
  } else {
    const isBanner = block.classList.contains('banner');
    if (isBanner) {
      contentEl.append(wrapper);
    } else {
      const paragraphs = [...contentEl.querySelectorAll('p')];
      let target = null;
      paragraphs.forEach((p) => {
        const a = p.querySelector('a');
        if (!(a && a.textContent.trim() === p.textContent.trim())) {
          target = p;
        }
      });
      if (target) {
        target.append(wrapper);
      } else {
        contentEl.append(wrapper);
      }
    }
  }

  function show() {
    positionPopup(trigger, popup);
    popup.classList.add('visible');
    trigger.setAttribute('aria-expanded', 'true');
  }

  function hide() {
    popup.classList.remove('visible');
    trigger.setAttribute('aria-expanded', 'false');
  }

  // Show on hover (wrapper + popup both keep it open)
  wrapper.addEventListener('mouseenter', show);
  popup.addEventListener('mouseenter', show);
  wrapper.addEventListener('mouseleave', (e) => {
    // Don't hide if moving to the popup
    if (!popup.contains(e.relatedTarget)) hide();
  });
  popup.addEventListener('mouseleave', (e) => {
    if (!wrapper.contains(e.relatedTarget)) hide();
  });

  // Toggle on click (touch devices)
  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (popup.classList.contains('visible')) hide();
    else show();
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target) && !popup.contains(e.target)) {
      hide();
    }
  });
}

/**
 * Detects marquee layout (hero → cards → hero) and adds section class.
 * @param {Element} block The hero block element
 */
function detectMarquee(block) {
  const section = block.closest('.section');
  if (!section || section.classList.contains('marquee')) return;

  const wrappers = [...section.children];
  const pattern = wrappers.map((w) => {
    const b = w.querySelector('[data-block-name]');
    return b ? b.getAttribute('data-block-name') : null;
  });

  if (
    pattern.length >= 3
    && pattern[0] === 'hero'
    && pattern[1] === 'cards'
    && pattern[2] === 'hero'
  ) {
    section.classList.add('marquee');
  }
}

/**
 * Rebuilds the block DOM with background image, content overlay, and disclaimer.
 * @param {Element} block The hero block element
 * @param {Element|null} imgEl The image or picture element
 * @param {Element|null} content The content wrapper element
 * @param {Element|null} disclaimer The disclaimer element
 * @param {boolean} isBanner Whether this is a banner variant
 */
function rebuildBlock(block, imgEl, content, disclaimer, isBanner) {
  block.textContent = '';

  if (imgEl) {
    const bgDiv = document.createElement('div');
    bgDiv.classList.add('hero-bg');
    bgDiv.append(imgEl);

    if (isBanner && content) {
      content.classList.add('hero-content');
      content.prepend(bgDiv);
      block.append(content);
    } else {
      block.append(bgDiv);
      if (content) {
        content.classList.add('hero-content');
        block.append(content);
      }
    }
  } else if (content) {
    content.classList.add('hero-content');
    block.append(content);
  }

  if (disclaimer) {
    disclaimer.classList.add('hero-disclaimer');
    block.append(disclaimer);
  }
}

/**
 * Decorates the hero block.
 * Restructures the rows (image + content + optional disclaimer) into
 * a background-image tile with text overlay.
 * @param {Element} block The hero block element
 */
export default function decorate(block) {
  const rows = [...block.children];
  const [imageRow, contentRow, disclaimerRow] = rows;

  const picture = imageRow?.querySelector('picture');
  const imgEl = picture || imageRow?.querySelector('img');
  const content = contentRow?.firstElementChild || contentRow;
  const disclaimer = disclaimerRow?.firstElementChild || disclaimerRow;
  const isBanner = block.classList.contains('banner');

  // Extract tooltip from italic paragraphs before rebuilding
  const tooltip = extractTooltip(content);

  rebuildBlock(block, imgEl, content, disclaimer, isBanner);

  if (tooltip) {
    buildTooltip(tooltip.text, tooltip.coords, block);
  }

  detectMarquee(block);
}
