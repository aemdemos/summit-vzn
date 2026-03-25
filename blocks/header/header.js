import { getMetadata } from '../../scripts/aem.js';

const isDesktop = window.matchMedia('(min-width: 900px)');
// W3C SVG namespace (standard URI, not a network request)
// eslint-disable-next-line browser-security/detect-mixed-content, browser-security/no-http-urls
const SVG_NS = 'http://www.w3.org/2000/svg';

/* =============================================
   UTILITIES
   ============================================= */

function cloneChildren(source, target) {
  [...source.childNodes].forEach((node) => {
    target.appendChild(node.cloneNode(true));
  });
}

function createSvg(attrs, children) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  Object.entries(attrs).forEach(([k, v]) => svg.setAttribute(k, v));
  children.forEach(([tag, childAttrs]) => {
    const el = document.createElementNS(SVG_NS, tag);
    Object.entries(childAttrs).forEach(([k, v]) => {
      el.setAttribute(k, v);
    });
    svg.appendChild(el);
  });
  return svg;
}

/* =============================================
   STATE MANAGEMENT
   ============================================= */

function closeAllPanels(nav) {
  nav.querySelectorAll('[aria-expanded="true"]').forEach((el) => {
    el.setAttribute('aria-expanded', 'false');
  });
  nav.querySelectorAll('.megamenu-panel.open, .dropdown-panel.open').forEach((el) => {
    el.classList.remove('open');
  });
  nav.querySelectorAll('.sidebar-categories .active').forEach((el) => {
    el.classList.remove('active');
  });
  nav.querySelectorAll('.category-panel.active').forEach((el) => {
    el.classList.remove('active');
  });
  nav.querySelectorAll('.featured-panel.active').forEach((el) => {
    el.classList.remove('active');
  });
  nav.querySelectorAll('.has-submenu.active').forEach((el) => {
    el.classList.remove('active');
  });
  nav.querySelectorAll('.megamenu-panel.has-col3-active').forEach((el) => {
    el.classList.remove('has-col3-active');
  });
  document.body.style.overflowY = '';
}

function activateCategory(panel, catId) {
  panel.querySelectorAll('.sidebar-categories .active').forEach((el) => el.classList.remove('active'));
  panel.querySelectorAll('.category-panel.active').forEach((el) => el.classList.remove('active'));
  panel.querySelectorAll('.featured-panel.active').forEach((el) => el.classList.remove('active'));
  panel.querySelectorAll('.has-submenu.active').forEach((el) => el.classList.remove('active'));
  panel.classList.remove('has-col3-active');

  const catLi = panel.querySelector(`.sidebar-categories li[data-category="${catId}"]`);
  if (catLi) catLi.classList.add('active');

  const catPanel = panel.querySelector(`.category-panel[data-category="${catId}"]`);
  if (catPanel) catPanel.classList.add('active');
}

function activateFeatured(panel, subcatId) {
  panel.querySelectorAll('.featured-panel.active').forEach((el) => el.classList.remove('active'));
  panel.querySelectorAll('.has-submenu.active').forEach((el) => el.classList.remove('active'));

  const fp = panel.querySelector(`.featured-panel[data-subcategory="${subcatId}"]`);
  if (fp) {
    fp.classList.add('active');
    panel.classList.add('has-col3-active');
  }

  const sm = panel.querySelector(`.has-submenu[data-subcategory="${subcatId}"]`);
  if (sm) sm.classList.add('active');
}

function clearFeatured(panel) {
  panel.querySelectorAll('.featured-panel.active').forEach((el) => el.classList.remove('active'));
  panel.querySelectorAll('.has-submenu.active').forEach((el) => el.classList.remove('active'));
  panel.classList.remove('has-col3-active');
}

/* =============================================
   OPEN / CLOSE
   ============================================= */

function openMegamenu(nav, trigger, panelId) {
  closeAllPanels(nav);
  trigger.setAttribute('aria-expanded', 'true');
  const panel = nav.querySelector(`.megamenu-panel[data-panel="${panelId}"]`);
  if (panel) {
    panel.classList.add('open');
  }
}

function openDropdown(nav, trigger, panelId) {
  closeAllPanels(nav);
  trigger.setAttribute('aria-expanded', 'true');
  const panel = nav.querySelector(`.dropdown-panel[data-panel="${panelId}"]`);
  if (panel) panel.classList.add('open');
}

/* =============================================
   BUILD FUNCTIONS
   ============================================= */

function buildUtilityBar(section) {
  const wrapper = document.createElement('div');
  wrapper.className = 'nav-utility-bar';
  const bar = section.querySelector('.nav-utility-bar');
  if (bar) cloneChildren(bar, wrapper);
  return wrapper;
}

function buildMainNav(section) {
  const wrapper = document.createElement('div');
  wrapper.className = 'nav-main-row';
  const main = section.querySelector('.nav-main');
  if (main) cloneChildren(main, wrapper);
  return wrapper;
}

function buildBrand(section) {
  const wrapper = document.createElement('div');
  wrapper.className = 'nav-brand';
  const brand = section.querySelector('.nav-brand');
  if (brand) cloneChildren(brand, wrapper);
  return wrapper;
}

function buildMegamenuPanel(section) {
  const panel = section.querySelector('.megamenu-panel');
  if (!panel) return null;
  const wrapper = document.createElement('div');
  wrapper.className = 'megamenu-panel';
  wrapper.setAttribute('data-panel', panel.getAttribute('data-panel'));
  wrapper.setAttribute('role', 'menu');
  cloneChildren(panel, wrapper);
  return wrapper;
}

function buildDropdownPanel(section) {
  const panel = section.querySelector('.dropdown-panel');
  if (!panel) return null;
  const wrapper = document.createElement('div');
  wrapper.className = 'dropdown-panel';
  wrapper.setAttribute('data-panel', panel.getAttribute('data-panel'));
  cloneChildren(panel, wrapper);
  return wrapper;
}

function buildPromoRibbon(section) {
  const wrapper = document.createElement('div');
  wrapper.className = 'nav-promo-ribbon';
  const promo = section.querySelector('.nav-promo-ribbon');
  if (promo) cloneChildren(promo, wrapper);
  return wrapper;
}

/* =============================================
   THREE-COLUMN LAYOUT UPGRADE
   ============================================= */

function upgradeToSidebarLayout(panel) {
  // Skip panels that already have sidebar structure
  if (panel.querySelector('.megamenu-sidebar')) return;
  const ul = panel.querySelector(':scope > ul');
  if (!ul) return;

  const panelId = panel.getAttribute('data-panel') || '';
  const heading = panelId.charAt(0).toUpperCase() + panelId.slice(1);

  const sidebar = document.createElement('div');
  sidebar.className = 'megamenu-sidebar';
  const h2 = document.createElement('h2');
  h2.textContent = heading;
  sidebar.appendChild(h2);
  sidebar.appendChild(ul);

  const content = document.createElement('div');
  content.className = 'megamenu-content';
  const col3 = document.createElement('div');
  col3.className = 'megamenu-col-3';

  const closeBtn = panel.querySelector('.megamenu-close');
  panel.insertBefore(sidebar, closeBtn || null);
  panel.insertBefore(content, closeBtn || null);
  panel.insertBefore(col3, closeBtn || null);
}

function upgradeToThreeColumnLayout(panel) {
  const sidebar = panel.querySelector('.megamenu-sidebar');
  const content = panel.querySelector('.megamenu-content');
  if (!sidebar || !content) return;

  const col3 = document.createElement('div');
  col3.className = 'megamenu-col-3';

  content.querySelectorAll('.has-submenu[data-subcategory]').forEach((submenu) => {
    const subcatId = submenu.getAttribute('data-subcategory');
    const catPanel = submenu.closest('.category-panel');
    const catId = catPanel ? catPanel.getAttribute('data-category') : '';
    const nestedUl = submenu.querySelector('ul');
    const btn = submenu.querySelector('button');
    const heading = btn ? btn.textContent.trim() : '';

    if (nestedUl) {
      const featuredPanel = document.createElement('div');
      featuredPanel.className = 'featured-panel';
      featuredPanel.setAttribute('data-subcategory', subcatId);
      featuredPanel.setAttribute('data-parent-category', catId);
      featuredPanel.setAttribute('role', 'menu');

      const h3 = document.createElement('h3');
      h3.textContent = heading;
      featuredPanel.appendChild(h3);
      featuredPanel.appendChild(nestedUl.cloneNode(true));
      col3.appendChild(featuredPanel);
    }
  });

  const closeBtn = panel.querySelector('.megamenu-close');
  if (closeBtn) {
    panel.insertBefore(col3, closeBtn);
  } else {
    panel.appendChild(col3);
  }
}

/* =============================================
   INTERACTIONS
   ============================================= */

function setupMegamenuInteractions(nav) {
  // Top-level megamenu triggers (Shop, Deals) — click to toggle
  nav.querySelectorAll('.nav-links .has-megamenu button').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const li = btn.closest('.has-megamenu');
      const panelId = li.getAttribute('data-megamenu');
      const isOpen = btn.getAttribute('aria-expanded') === 'true';
      if (isOpen) {
        closeAllPanels(nav);
      } else {
        openMegamenu(nav, btn, panelId);
      }
    });
  });

  // Column 1 → Column 2: hover switches category (desktop), click (mobile)
  nav.querySelectorAll('.sidebar-categories li[data-category]').forEach((li) => {
    const btn = li.querySelector('button');
    if (!btn) return;

    li.addEventListener('mouseenter', () => {
      if (!isDesktop.matches) return;
      const panel = li.closest('.megamenu-panel');
      const catId = li.getAttribute('data-category');
      activateCategory(panel, catId);
    });

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const panel = li.closest('.megamenu-panel');
      const catId = li.getAttribute('data-category');
      activateCategory(panel, catId);
    });
  });

  // Column 2 → Column 3: hover submenu shows featured panel (desktop)
  nav.querySelectorAll('.has-submenu[data-subcategory]').forEach((submenu) => {
    submenu.addEventListener('mouseenter', () => {
      if (!isDesktop.matches) return;
      const panel = submenu.closest('.megamenu-panel');
      const subcatId = submenu.getAttribute('data-subcategory');
      activateFeatured(panel, subcatId);
    });
  });

  // Column 2: hover non-submenu items hides Column 3 (desktop)
  nav.querySelectorAll('.category-panel > ul > li:not(.has-submenu)').forEach((li) => {
    li.addEventListener('mouseenter', () => {
      if (!isDesktop.matches) return;
      const panel = li.closest('.megamenu-panel');
      clearFeatured(panel);
    });
  });

  // 3rd-level submenu toggles — mobile accordion only
  nav.querySelectorAll('.has-submenu > button').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isDesktop.matches) return;
      const li = btn.closest('.has-submenu');
      li.classList.toggle('expanded');
    });
  });

  // Sign in dropdown
  nav.querySelectorAll('.nav-signin button').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const li = btn.closest('.nav-signin');
      const panelId = li.getAttribute('data-dropdown');
      const isOpen = btn.getAttribute('aria-expanded') === 'true';
      if (isOpen) {
        closeAllPanels(nav);
      } else {
        openDropdown(nav, btn, panelId);
      }
    });
  });

  // Close buttons
  nav.querySelectorAll('.megamenu-close').forEach((btn) => {
    btn.addEventListener('click', () => closeAllPanels(nav));
  });
  nav.querySelectorAll('.dropdown-close').forEach((btn) => {
    btn.addEventListener('click', () => closeAllPanels(nav));
  });

  // Click outside to close
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.nav-wrapper')) {
      closeAllPanels(nav);
    }
  });

  // Escape key to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllPanels(nav);
    }
  });
}

/* =============================================
   ENHANCEMENTS
   ============================================= */

function addCloseButtons(nav) {
  nav.querySelectorAll('.megamenu-panel').forEach((panel) => {
    const closeBtn = document.createElement('button');
    closeBtn.className = 'megamenu-close';
    closeBtn.setAttribute('aria-label', 'Close menu');
    closeBtn.appendChild(createSvg(
      { viewBox: '0 0 24 24', width: '24', height: '24' },
      [['path', {
        d: 'M18 6L6 18M6 6l12 12',
        stroke: 'currentColor',
        'stroke-width': '2',
        'stroke-linecap': 'round',
      }]],
    ));
    panel.appendChild(closeBtn);
  });

  nav.querySelectorAll('.dropdown-panel').forEach((panel) => {
    const closeBtn = document.createElement('button');
    closeBtn.className = 'dropdown-close';
    closeBtn.textContent = 'Close';
    panel.appendChild(closeBtn);
  });
}

function addChevrons(nav) {
  nav.querySelectorAll('.sidebar-categories li[data-category] button').forEach((btn) => {
    const chevron = document.createElement('span');
    chevron.className = 'chevron-right';
    btn.appendChild(chevron);
  });

  nav.querySelectorAll('.has-submenu > button').forEach((btn) => {
    if (!btn.querySelector('.chevron-right')) {
      const chevron = document.createElement('span');
      chevron.className = 'chevron-right';
      btn.appendChild(chevron);
    }
  });
}

function addSearchIcon(nav) {
  const searchTrigger = nav.querySelector('.search-trigger');
  if (searchTrigger) {
    const svg = createSvg(
      {
        viewBox: '0 0 24 24',
        width: '20',
        height: '20',
        class: 'search-icon',
      },
      [
        ['circle', {
          cx: '10', cy: '10', r: '7', fill: 'none', stroke: 'currentColor', 'stroke-width': '2',
        }],
        ['path', {
          d: 'M15 15l5 5', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round',
        }],
      ],
    );
    searchTrigger.prepend(svg);
  }
}

function addCartIcon(nav) {
  const cartTrigger = nav.querySelector('.cart-trigger');
  if (cartTrigger) {
    cartTrigger.textContent = '';
    cartTrigger.appendChild(createSvg(
      {
        viewBox: '0 0 24 24',
        width: '24',
        height: '24',
        class: 'cart-icon',
      },
      [
        ['path', {
          d: 'M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z',
          fill: 'none',
          stroke: 'currentColor',
          'stroke-width': '1.5',
        }],
        ['path', {
          d: 'M3 6h18',
          stroke: 'currentColor',
          'stroke-width': '1.5',
        }],
        ['path', {
          d: 'M16 10a4 4 0 01-8 0',
          fill: 'none',
          stroke: 'currentColor',
          'stroke-width': '1.5',
        }],
      ],
    ));
  }
}

function setupMobileMenu(nav) {
  const hamburger = document.createElement('div');
  hamburger.className = 'nav-hamburger';
  const menuBtn = document.createElement('button');
  menuBtn.type = 'button';
  menuBtn.setAttribute('aria-controls', 'nav');
  menuBtn.setAttribute('aria-label', 'Open navigation');
  for (let i = 0; i < 3; i += 1) {
    const line = document.createElement('span');
    line.className = 'hamburger-line';
    menuBtn.appendChild(line);
  }
  hamburger.appendChild(menuBtn);

  hamburger.addEventListener('click', () => {
    const expanded = nav.getAttribute('aria-expanded') === 'true';
    nav.setAttribute('aria-expanded', expanded ? 'false' : 'true');
    document.body.style.overflowY = expanded ? '' : 'hidden';
  });

  const mainRow = nav.querySelector('.nav-main-row');
  if (mainRow) mainRow.prepend(hamburger);

  isDesktop.addEventListener('change', () => {
    if (isDesktop.matches) {
      nav.setAttribute('aria-expanded', 'false');
      document.body.style.overflowY = '';
      closeAllPanels(nav);
    }
  });
}

/* =============================================
   NAV ASSEMBLY
   ============================================= */

function buildNavSections(nav, sections) {
  if (sections[1]) nav.appendChild(buildUtilityBar(sections[1]));

  if (sections[2]) {
    const mainRow = buildMainNav(sections[2]);
    if (sections[0]) mainRow.prepend(buildBrand(sections[0]));
    nav.appendChild(mainRow);
  }

  if (sections[3]) {
    const panel = buildMegamenuPanel(sections[3]);
    if (panel) nav.appendChild(panel);
  }

  if (sections[4]) {
    const panel = buildMegamenuPanel(sections[4]);
    if (panel) nav.appendChild(panel);
  }

  if (sections[5]) {
    const panel = buildDropdownPanel(sections[5]);
    if (panel) nav.appendChild(panel);
  }

  if (sections[6]) nav.appendChild(buildPromoRibbon(sections[6]));
}

/* =============================================
   DECORATE
   ============================================= */

export default async function decorate(block) {
  const navMeta = getMetadata('nav');
  const navPath = navMeta
    ? new URL(navMeta, window.location).pathname
    : `${window.hlx?.codeBasePath ?? ''}/nav`;

  let resp = await fetch(`/content${navPath}.plain.html`);
  if (!resp.ok) resp = await fetch(`${navPath}.plain.html`);
  if (!resp.ok) return;

  let html = await resp.text();
  // If EDS pipeline stripped the nav content, retry with the content path
  if (!html.includes('<a') && !html.includes('<ul')) {
    const retry = await fetch(`/content${navPath}.plain.html`);
    if (retry.ok) html = await retry.text();
  }
  // DOMParser with text/html is safe in browsers (no XXE risk)
  // eslint-disable-next-line
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const sections = [...doc.body.querySelectorAll(':scope > div')];

  block.textContent = '';
  const nav = document.createElement('nav');
  nav.id = 'nav';
  nav.setAttribute('aria-expanded', 'false');

  buildNavSections(nav, sections);
  addCloseButtons(nav);
  addChevrons(nav);

  // Ensure all megamenu panels have sidebar structure, then upgrade to 3-column
  nav.querySelectorAll('.megamenu-panel').forEach((panel) => {
    upgradeToSidebarLayout(panel);
    upgradeToThreeColumnLayout(panel);
  });

  addSearchIcon(nav);
  addCartIcon(nav);
  setupMobileMenu(nav);
  setupMegamenuInteractions(nav);

  const navWrapper = document.createElement('div');
  navWrapper.className = 'nav-wrapper';
  navWrapper.appendChild(nav);
  block.appendChild(navWrapper);
}
