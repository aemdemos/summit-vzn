import { getMetadata, loadSections, DOMPURIFY } from '../../scripts/aem.js';
// eslint-disable-next-line import/no-cycle
import { decorateMain, ensureDOMPurify } from '../../scripts/scripts.js';

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

function slugify(text) {
  return text.toLowerCase()
    .replace(/&/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Parses an authorable content cell into a UL with regular links and has-submenu items.
 * - <p> with <a> → regular <li><a>
 * - <p> with plain text → submenu header (has-submenu <li> with <button>)
 * - <ul> after a submenu header → nested submenu items
 */
function parseCategoryContent(cell) {
  const ul = document.createElement('ul');
  let currentSubmenu = null;

  [...cell.children].forEach((el) => {
    if (el.tagName === 'P') {
      const link = el.querySelector('a');
      if (link) {
        currentSubmenu = null;
        const li = document.createElement('li');
        li.appendChild(link.cloneNode(true));
        ul.appendChild(li);
      } else {
        const text = el.textContent.trim();
        if (text) {
          currentSubmenu = document.createElement('li');
          currentSubmenu.className = 'has-submenu';
          currentSubmenu.setAttribute('data-subcategory', slugify(text));
          const btn = document.createElement('button');
          btn.textContent = text;
          currentSubmenu.appendChild(btn);
          ul.appendChild(currentSubmenu);
        }
      }
    } else if (el.tagName === 'UL' && currentSubmenu) {
      currentSubmenu.appendChild(el.cloneNode(true));
      currentSubmenu = null;
    }
  });

  return ul;
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
  if (!bar) return wrapper;

  // Parse two-column block table: col 1 = left links, col 2 = right links
  const row = bar.querySelector(':scope > div');
  if (!row) return wrapper;
  const cells = [...row.querySelectorAll(':scope > div')];

  // Left utility links (col 1)
  if (cells[0]) {
    const leftUl = cells[0].querySelector('ul');
    if (leftUl) {
      const clone = leftUl.cloneNode(true);
      clone.className = 'utility-left';
      // Mark first link as active (Personal)
      const firstLink = clone.querySelector('a');
      if (firstLink) firstLink.classList.add('active');
      wrapper.appendChild(clone);
    }
  }

  // Right utility links (col 2)
  if (cells[1]) {
    const rightUl = cells[1].querySelector('ul');
    if (rightUl) {
      const clone = rightUl.cloneNode(true);
      clone.className = 'utility-right';
      // Detect locale link (Español) by URL hostname
      clone.querySelectorAll('a').forEach((a) => {
        const href = a.getAttribute('href') || '';
        if (href.includes('espanol.')) {
          a.classList.add('locale-link');
        }
      });
      wrapper.appendChild(clone);
    }
  }

  return wrapper;
}

function buildMainNav(section) {
  const wrapper = document.createElement('div');
  wrapper.className = 'nav-main-row';
  const main = section.querySelector('.nav-main');
  if (!main) return wrapper;

  // Parse two-column block table: col 1 = nav links, col 2 = tools
  const row = main.querySelector(':scope > div');
  if (!row) return wrapper;
  const cells = [...row.querySelectorAll(':scope > div')];

  // Nav links (col 1): items with <a> = direct links, plain text = megamenu triggers
  if (cells[0]) {
    const sourceUl = cells[0].querySelector('ul');
    if (sourceUl) {
      const navLinks = document.createElement('ul');
      navLinks.className = 'nav-links';

      [...sourceUl.querySelectorAll(':scope > li')].forEach((li) => {
        const link = li.querySelector('a');
        const newLi = document.createElement('li');

        if (link) {
          newLi.appendChild(link.cloneNode(true));
        } else {
          // Plain text = megamenu trigger button
          const text = li.textContent.trim();
          const panelId = slugify(text);
          newLi.className = 'has-megamenu';
          newLi.setAttribute('data-megamenu', panelId);
          const btn = document.createElement('button');
          btn.setAttribute('aria-label', `${text} Menu List`);
          btn.setAttribute('aria-expanded', 'false');
          btn.textContent = text;
          newLi.appendChild(btn);
        }

        navLinks.appendChild(newLi);
      });

      wrapper.appendChild(navLinks);
    }
  }

  // Tools (col 2): detect by text content → search, sign in, cart
  if (cells[1]) {
    const sourceUl = cells[1].querySelector('ul');
    if (sourceUl) {
      const navTools = document.createElement('ul');
      navTools.className = 'nav-tools';

      [...sourceUl.querySelectorAll(':scope > li')].forEach((li) => {
        const text = li.textContent.trim().toLowerCase();
        const newLi = document.createElement('li');

        if (text.includes('search')) {
          newLi.className = 'nav-search';
          const btn = document.createElement('button');
          btn.setAttribute('aria-label', 'Search Verizon');
          btn.className = 'search-trigger';
          btn.textContent = 'Search Verizon';
          newLi.appendChild(btn);
        } else if (text.includes('sign in') || text.includes('signin')) {
          newLi.className = 'nav-signin has-dropdown';
          newLi.setAttribute('data-dropdown', slugify(li.textContent.trim()));
          const btn = document.createElement('button');
          btn.setAttribute('aria-label', 'Sign in dropdown menu');
          btn.setAttribute('aria-expanded', 'false');
          btn.textContent = 'Sign in';
          newLi.appendChild(btn);
        } else if (text.includes('cart')) {
          newLi.className = 'nav-cart';
          const btn = document.createElement('button');
          btn.setAttribute('aria-label', 'Shopping Cart Menu 0 items in the cart');
          btn.className = 'cart-trigger';
          newLi.appendChild(btn);
        }

        navTools.appendChild(newLi);
      });

      wrapper.appendChild(navTools);
    }
  }

  return wrapper;
}

function buildBrand(section) {
  const wrapper = document.createElement('div');
  wrapper.className = 'nav-brand';
  const brand = section.querySelector('.nav-brand');
  if (!brand) return wrapper;

  // Find the logo link inside block table cells (EDS-compatible)
  const link = brand.querySelector('a');
  if (link) {
    const clone = link.cloneNode(true);
    if (!clone.getAttribute('aria-label')) {
      clone.setAttribute('aria-label', 'Verizon Home Page');
    }
    wrapper.appendChild(clone);
  }
  return wrapper;
}

function buildMegamenuPanel(section) {
  const panel = section.querySelector('[class*="megamenu-panel"]');
  if (!panel) return null;

  const wrapper = document.createElement('div');
  wrapper.className = 'megamenu-panel';
  wrapper.setAttribute('role', 'menu');

  // Extract panel ID from data-panel or variant class
  let panelId = panel.getAttribute('data-panel');
  if (!panelId) {
    panelId = [...panel.classList].find((c) => c !== 'megamenu-panel') || '';
  }

  const rows = [...panel.querySelectorAll(':scope > div')];

  // If no row structure, fall back to cloning content as-is
  if (rows.length === 0) {
    wrapper.setAttribute('data-panel', panelId);
    cloneChildren(panel, wrapper);
    return wrapper;
  }

  // Row 1: H2 (menu label) + UL (first-level nav items / sidebar categories)
  const headerRow = rows[0];
  const headerCell = headerRow.querySelector(':scope > div') || headerRow;
  const h2 = headerCell.querySelector('h2');
  const sidebarUl = headerCell.querySelector('ul');

  // Derive panel ID from H2 when data-panel is stripped (e.g. by EDS pipeline)
  if (!panelId && h2) {
    panelId = h2.id || slugify(h2.textContent.trim());
  }
  wrapper.setAttribute('data-panel', panelId);

  // Category rows: each has H3 in col 1, sub-items in col 2
  const categoryRows = rows.slice(1);

  // Build sidebar
  const sidebar = document.createElement('div');
  sidebar.className = 'megamenu-sidebar';
  if (h2) sidebar.appendChild(h2.cloneNode(true));

  // Simple panel (e.g. Deals): no category rows, just direct links
  if (categoryRows.length === 0) {
    if (sidebarUl) sidebar.appendChild(sidebarUl.cloneNode(true));
    wrapper.appendChild(sidebar);
    return wrapper;
  }

  // Complex panel (e.g. Shop): derive sidebar categories from category rows directly
  const sidebarCategories = document.createElement('ul');
  sidebarCategories.className = 'sidebar-categories';

  const content = document.createElement('div');
  content.className = 'megamenu-content';

  // Build sidebar + content panels from each category row's H3 (col 1) + sub-items (col 2)
  categoryRows.forEach((row) => {
    const cells = [...row.querySelectorAll(':scope > div')];
    const firstCell = cells[0] || row;
    const rowH3 = firstCell.querySelector('h3');
    if (!rowH3) return;

    const text = rowH3.textContent.trim();
    const catId = slugify(text);
    const contentCell = cells.length > 1 ? cells[1] : null;
    const link = firstCell.querySelector('a');
    const li = document.createElement('li');

    if (contentCell) {
      // Category with sub-items → button trigger + category panel
      li.setAttribute('data-category', catId);
      const btn = document.createElement('button');
      btn.textContent = text;
      li.appendChild(btn);

      const catPanel = document.createElement('div');
      catPanel.className = 'category-panel';
      catPanel.setAttribute('data-category', catId);

      // Add category name as column heading above sub-items
      const catHeading = document.createElement('h3');
      catHeading.className = 'category-heading';
      catHeading.textContent = text;
      catPanel.appendChild(catHeading);

      catPanel.appendChild(parseCategoryContent(contentCell));
      content.appendChild(catPanel);
    } else if (link) {
      // Direct link (e.g. myAccess) — H3 wraps an anchor
      li.appendChild(link.cloneNode(true));
    }

    sidebarCategories.appendChild(li);
  });

  sidebar.appendChild(sidebarCategories);
  wrapper.appendChild(sidebar);
  wrapper.appendChild(content);

  return wrapper;
}

function buildDropdownPanel(section) {
  const panel = section.querySelector('[class*="dropdown-panel"]');
  if (!panel) return null;

  const wrapper = document.createElement('div');
  wrapper.className = 'dropdown-panel';

  // Derive panel ID: data-panel (local) or H2 heading (EDS-compatible)
  let panelId = panel.getAttribute('data-panel');
  const cell = panel.querySelector(':scope > div > div') || panel;
  const h2 = cell.querySelector('h2');
  if (!panelId && h2) {
    panelId = h2.id || slugify(h2.textContent.trim());
  }
  wrapper.setAttribute('data-panel', panelId || '');

  // Clone only the link list, not the heading (heading is for identification only)
  const ul = cell.querySelector('ul');
  if (ul) wrapper.appendChild(ul.cloneNode(true));

  return wrapper;
}

function buildPromoRibbon(section) {
  const wrapper = document.createElement('div');
  wrapper.className = 'nav-promo-ribbon';
  const promo = section.querySelector('.nav-promo-ribbon');
  if (!promo) return wrapper;

  const cell = promo.querySelector(':scope > div > div') || promo;
  const ul = cell.querySelector('ul');

  // Single item (no UL) — render plain text as before
  if (!ul) {
    cloneChildren(cell, wrapper);
    return wrapper;
  }

  // Multiple items — build carousel
  const items = [...ul.querySelectorAll(':scope > li')];
  const track = document.createElement('div');
  track.className = 'promo-track';
  track.setAttribute('role', 'group');
  track.setAttribute('aria-label', `Verizon Promos with ${items.length} promotions`);

  items.forEach((li, i) => {
    const slide = document.createElement('div');
    slide.className = 'promo-slide';
    slide.setAttribute('aria-label', `Promo ${i + 1} of ${items.length}`);
    if (i === 0) slide.classList.add('active');
    // Move all child nodes (text + links) into the slide
    const p = document.createElement('p');
    [...li.childNodes].forEach((node) => p.appendChild(node.cloneNode(true)));
    slide.appendChild(p);
    track.appendChild(slide);
  });

  // Prev arrow
  const prevBtn = document.createElement('button');
  prevBtn.className = 'promo-arrow promo-arrow-prev';
  prevBtn.setAttribute('aria-label', 'Previous promotion');
  prevBtn.appendChild(createSvg(
    { viewBox: '0 0 21.6 21.6', width: '16', height: '16' },
    [['polygon', { points: '14.89 19.8 5.89 10.799 14.89 1.8 15.71 2.619 7.53 10.799 15.71 18.981 14.89 19.8' }]],
  ));

  // Next arrow
  const nextBtn = document.createElement('button');
  nextBtn.className = 'promo-arrow promo-arrow-next';
  nextBtn.setAttribute('aria-label', 'Next promotion');
  nextBtn.appendChild(createSvg(
    { viewBox: '0 0 21.6 21.6', width: '16', height: '16' },
    [['polygon', { points: '6.71 19.8 5.89 18.981 14.07 10.799 5.89 2.619 6.71 1.8 15.71 10.799 6.71 19.8' }]],
  ));

  wrapper.appendChild(prevBtn);
  wrapper.appendChild(track);
  wrapper.appendChild(nextBtn);

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

function setupPromoRibbon(nav) {
  const ribbon = nav.querySelector('.nav-promo-ribbon');
  if (!ribbon) return;
  const slides = ribbon.querySelectorAll('.promo-slide');
  if (slides.length < 2) return;

  let current = 0;

  function goTo(index) {
    slides[current].classList.remove('active');
    current = (index + slides.length) % slides.length;
    slides[current].classList.add('active');
  }

  const prevBtn = ribbon.querySelector('.promo-arrow-prev');
  const nextBtn = ribbon.querySelector('.promo-arrow-next');
  if (prevBtn) prevBtn.addEventListener('click', () => goTo(current - 1));
  if (nextBtn) nextBtn.addEventListener('click', () => goTo(current + 1));
}

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
    searchTrigger.append(svg);
  }
}

function addCartIcon(nav) {
  const cartTrigger = nav.querySelector('.cart-trigger');
  if (cartTrigger) {
    cartTrigger.textContent = '';
    cartTrigger.appendChild(createSvg(
      {
        viewBox: '0 0 21.6 21.6',
        width: '24',
        height: '24',
        class: 'cart-icon',
      },
      [
        ['path', {
          d: [
            'M19.63887,4.5507H5.74775L5.40107,2.85831,2.3249,1.79972,',
            '1.96113,2.85807l2.47217.85059L6.91719,15.84281a2.10574,',
            '2.10574,0,1,0,3.02588,2.43836h4.41406a2.112,2.112,0,1,',
            '0,0-1.18689H9.94307a2.104,2.104,0,0,0-1.937-1.51185l-',
            '.38378-1.87524,11.08691-1.32935Zm-3.26465,12.213a.924.',
            '924,0,1,1-.92438.924A.924.924,0,0,1,16.37422,16.76371Z',
            'm-8.44861,0H7.926a.92414.92414,0,1,1-.00037,0Zm9.77576',
            '-5.392L7.39711,12.60722,5.97676,5.66959h12.4024Z',
          ].join(''),
          fill: 'currentColor',
          stroke: 'currentColor',
          'stroke-width': '0.1',
        }],
      ],
    ));
  }
}

function setupSearchOverlay(nav) {
  const searchTrigger = nav.querySelector('.search-trigger');
  if (!searchTrigger) return;

  let overlay = null;
  let fragmentLoaded = false;

  function closeOverlay() {
    if (overlay) {
      overlay.classList.remove('open');
      document.body.style.overflowY = '';
    }
  }

  async function openOverlay() {
    closeAllPanels(nav);

    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'search-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-label', 'Search');

      // Backdrop (semi-transparent white covering the bottom half)
      const backdrop = document.createElement('div');
      backdrop.className = 'search-overlay-backdrop';
      backdrop.addEventListener('click', closeOverlay);
      // Content area (solid white top) — comes first in flex column
      const content = document.createElement('div');
      content.className = 'search-overlay-content';

      // Header row: Verizon logo + close button
      const header = document.createElement('div');
      header.className = 'search-overlay-header';

      const logo = nav.querySelector('.nav-brand a');
      if (logo) {
        const logoClone = logo.cloneNode(true);
        logoClone.className = 'search-overlay-logo';
        header.appendChild(logoClone);
      }

      const closeBtn = document.createElement('button');
      closeBtn.className = 'search-overlay-close';
      closeBtn.setAttribute('aria-label', 'Close search');
      closeBtn.appendChild(createSvg(
        { viewBox: '0 0 24 24', width: '24', height: '24' },
        [['path', {
          d: 'M18 6L6 18M6 6l12 12',
          stroke: 'currentColor',
          'stroke-width': '2',
          'stroke-linecap': 'round',
        }]],
      ));
      closeBtn.addEventListener('click', closeOverlay);
      header.appendChild(closeBtn);
      content.appendChild(header);

      // Fragment content area
      const fragmentArea = document.createElement('div');
      fragmentArea.className = 'search-overlay-fragment';
      content.appendChild(fragmentArea);

      overlay.appendChild(content);
      overlay.appendChild(backdrop);
      document.body.appendChild(overlay);
    }

    overlay.classList.add('open');
    document.body.style.overflowY = 'hidden';

    // Load fragment on first open
    if (!fragmentLoaded) {
      fragmentLoaded = true;
      const fragmentArea = overlay.querySelector('.search-overlay-fragment');
      try {
        await ensureDOMPurify();
        const resp = await fetch('/content/search.plain.html');
        if (resp.ok) {
          const main = document.createElement('main');
          main.innerHTML = window.DOMPurify.sanitize(
            await resp.text(),
            DOMPURIFY,
          );
          decorateMain(main);
          await loadSections(main);
          fragmentArea.appendChild(main);

          // Focus the search input after it's rendered
          const input = fragmentArea.querySelector('.search-input');
          if (input) {
            input.placeholder = 'Search Verizon';
            input.setAttribute('aria-label', 'Search Verizon');
            input.focus();
          }
        }
      } catch {
        // silently handle fragment load failure
      }
    } else {
      // Re-focus input on subsequent opens
      const input = overlay.querySelector('.search-input');
      if (input) input.focus();
    }
  }

  searchTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (overlay && overlay.classList.contains('open')) {
      closeOverlay();
    } else {
      openOverlay();
    }
  });

  // Escape key closes overlay
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay && overlay.classList.contains('open')) {
      closeOverlay();
    }
  });
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
  // Discover sections by their block class name instead of hardcoded indices
  let brandSection;
  let utilitySection;
  let mainSection;
  let promoSection;
  const megamenuSections = [];
  const dropdownSections = [];

  sections.forEach((section) => {
    if (section.querySelector('.nav-brand')) brandSection = section;
    else if (section.querySelector('.nav-utility-bar')) utilitySection = section;
    else if (section.querySelector('.nav-main')) mainSection = section;
    else if (section.querySelector('[class*="megamenu-panel"]')) megamenuSections.push(section);
    else if (section.querySelector('[class*="dropdown-panel"]')) dropdownSections.push(section);
    else if (section.querySelector('.nav-promo-ribbon')) promoSection = section;
  });

  if (utilitySection) nav.appendChild(buildUtilityBar(utilitySection));

  if (mainSection) {
    const mainRow = buildMainNav(mainSection);
    if (brandSection) mainRow.prepend(buildBrand(brandSection));
    nav.appendChild(mainRow);
  }

  megamenuSections.forEach((s) => {
    const panel = buildMegamenuPanel(s);
    if (panel) nav.appendChild(panel);
  });

  dropdownSections.forEach((s) => {
    const panel = buildDropdownPanel(s);
    if (panel) nav.appendChild(panel);
  });

  if (promoSection) nav.appendChild(buildPromoRibbon(promoSection));
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
  setupSearchOverlay(nav);
  setupMegamenuInteractions(nav);
  setupPromoRibbon(nav);

  const navWrapper = document.createElement('div');
  navWrapper.className = 'nav-wrapper';
  navWrapper.appendChild(nav);
  block.appendChild(navWrapper);
}
