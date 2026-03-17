/**
 * Decorates the hero block.
 * Restructures the rows (image + content + optional disclaimer) into
 * a background-image tile with text overlay.
 * @param {Element} block The hero block element
 */
export default function decorate(block) {
  const rows = [...block.children];
  const [imageRow, contentRow, disclaimerRow] = rows;

  // Extract image element (prefer <picture> to keep responsive sources)
  const picture = imageRow?.querySelector('picture');
  const imgEl = picture || imageRow?.querySelector('img');

  // Extract content wrapper (the inner div with heading + paragraphs)
  const content = contentRow?.firstElementChild || contentRow;

  // Extract optional disclaimer text (third row)
  const disclaimer = disclaimerRow?.firstElementChild || disclaimerRow;

  // Rebuild block: background image + content overlay + optional disclaimer
  block.textContent = '';

  if (imgEl) {
    const bgDiv = document.createElement('div');
    bgDiv.classList.add('hero-bg');
    bgDiv.append(imgEl);
    block.append(bgDiv);
  }

  if (content) {
    content.classList.add('hero-content');
    block.append(content);
  }

  if (disclaimer) {
    disclaimer.classList.add('hero-disclaimer');
    block.append(disclaimer);
  }

  // Detect marquee layout: section has hero-wrapper → cards-wrapper → hero-wrapper
  const section = block.closest('.section');
  if (section && !section.classList.contains('marquee')) {
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
}
