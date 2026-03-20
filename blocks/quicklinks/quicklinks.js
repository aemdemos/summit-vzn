/**
 * Quicklinks block — horizontal row of pill-shaped navigation links.
 *
 * Content model (each row = one link):
 * | icon (picture) | link text (paragraph with anchor) |
 *
 * The block transforms table rows into a <nav> with a horizontal
 * scrollable list of pill links, each with an optional icon image.
 *
 * Icon images use PNG format to preserve transparency from the
 * original Scene7 CDN assets (webp-alpha is unsupported by DA).
 * @param {Element} block
 */
export default function decorate(block) {
  const nav = document.createElement('nav');
  nav.className = 'quicklinks-nav';
  nav.setAttribute('aria-label', 'Quick links');

  [...block.children].forEach((row) => {
    const cols = [...row.children];
    const link = row.querySelector('a[href]');
    if (!link) return;

    const pill = document.createElement('a');
    pill.href = link.href;
    pill.className = 'quicklinks-pill';

    // Column 1 may contain an icon image
    const img = cols[0]?.querySelector('img');
    if (img) {
      const icon = document.createElement('span');
      icon.className = 'quicklinks-icon';
      const iconImg = document.createElement('img');
      iconImg.src = img.src;
      iconImg.alt = '';
      iconImg.loading = 'eager';
      iconImg.width = 28;
      iconImg.height = 28;
      icon.append(iconImg);
      pill.append(icon);
    }

    const label = document.createElement('span');
    label.className = 'quicklinks-label';
    label.textContent = link.textContent.trim();
    pill.append(label);

    nav.append(pill);
  });

  block.textContent = '';
  block.append(nav);
}
