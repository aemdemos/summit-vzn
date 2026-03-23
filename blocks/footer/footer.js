import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

/**
 * Groups sibling elements under h2 headings into column divs.
 * Each h2 starts a new column; h3 and other elements attach to the current column.
 * @param {Element} wrapper The default-content-wrapper element
 */
function buildColumns(wrapper) {
  const children = [...wrapper.children];
  const columns = [];
  let current = null;

  children.forEach((child) => {
    if (child.tagName === 'H2') {
      current = document.createElement('div');
      current.className = 'footer-column';
      current.append(child);
      columns.push(current);
    } else if (current) {
      current.append(child);
    }
  });

  wrapper.textContent = '';
  columns.forEach((col) => wrapper.append(col));
}

/**
 * Adds accordion toggle behavior for mobile viewports.
 * @param {Element} section The footer-links section
 */
function addAccordion(section) {
  const columns = section.querySelectorAll('.footer-column');
  columns.forEach((col) => {
    const heading = col.querySelector('h2');
    if (!heading) return;

    heading.setAttribute('role', 'button');
    heading.setAttribute('aria-expanded', 'false');
    heading.setAttribute('tabindex', '0');

    const toggle = () => {
      const open = col.classList.toggle('open');
      heading.setAttribute('aria-expanded', String(open));
    };

    heading.addEventListener('click', toggle);
    heading.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    });
  });
}

/**
 * Marks the social links column so CSS can style icons inline.
 * @param {Element} section The footer-links section
 */
function decorateSocial(section) {
  const columns = section.querySelectorAll('.footer-column');
  columns.forEach((col) => {
    const hasIcons = col.querySelector('.icon');
    if (hasIcons) col.classList.add('footer-social');
  });
}

/**
 * Loads and decorates the footer.
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  const footerMeta = getMetadata('footer');
  const footerPath = footerMeta
    ? new URL(footerMeta, window.location).pathname
    : '/footer';
  const fragment = await loadFragment(footerPath);

  block.textContent = '';
  const footer = document.createElement('div');
  while (fragment.firstElementChild) footer.append(fragment.firstElementChild);

  const sections = footer.querySelectorAll('.section');
  sections.forEach((section, i) => {
    if (i < sections.length - 1) {
      section.classList.add('footer-links');
      const wrapper = section.querySelector('.default-content-wrapper');
      if (wrapper) {
        buildColumns(wrapper);
        addAccordion(section);
        decorateSocial(section);
      }
    } else {
      section.classList.add('footer-bottom');
    }
  });

  block.append(footer);
}
