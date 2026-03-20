/* eslint-disable */
/* global WebImporter */

// PARSER IMPORTS
import heroParser from './parsers/hero.js';
import cardsParser from './parsers/cards.js';
import quicklinksParser from './parsers/quicklinks.js';

// TRANSFORMER IMPORTS
import cleanupTransformer from './transformers/verizon-cleanup.js';
import sectionsTransformer from './transformers/verizon-sections.js';

// PAGE TEMPLATE CONFIGURATION - Embedded from page-templates.json
const PAGE_TEMPLATE = {
  name: 'homepage',
  urls: ['https://www.verizon.com/'],
  description: 'Verizon homepage with hero carousel, deals grid, service cards, and category navigation',
  blocks: [
    {
      name: 'quicklinks',
      instances: ['section#quickLinks-pzn'],
    },
    {
      name: 'hero',
      instances: ['.vui\\:cmp-marqueelayout__tile-1'],
    },
    {
      name: 'cards',
      instances: [
        '.vui\\:cmp-marqueelayout__tile-2, .vui\\:cmp-marqueelayout__tile-3',
        '.vui\\:fed__deals-tile',
        '.vui\\:cmp-previewtiles__tile',
        '.vui\\:cmp-categorytilettes__tilette',
      ],
    },
    {
      name: 'hero',
      instances: ['.vui\\:cmp-marqueelayout__skinny-banner'],
      section: 'red',
    },
  ],
  sections: [
    {
      id: 'section-quicklinks',
      name: 'Quick Links Navigation',
      selector: 'section#quickLinks-pzn',
      style: null,
      blocks: ['quicklinks'],
      defaultContent: [],
    },
    {
      id: 'section-hero',
      name: 'Hero Marquee Layout',
      selector: 'section.vui\\:cmp-marqueelayout',
      style: null,
      blocks: ['hero', 'cards'],
      defaultContent: [],
    },
    {
      id: 'section-5g-banner',
      name: '5G Network Banner',
      selector: '.vui\\:cmp-marqueelayout__skinny-banner',
      style: 'red',
      blocks: ['hero'],
      defaultContent: [],
    },
    {
      id: 'section-deals',
      name: 'Deals & Discounts',
      selector: 'section#deals-discount',
      style: null,
      blocks: ['cards'],
      defaultContent: ['#deals-discount h2'],
    },
    {
      id: 'section-services',
      name: 'Stay Connected & Save',
      selector: 'section.vui\\:cmp-previewtiles',
      style: null,
      blocks: ['cards'],
      defaultContent: ['.vui\\:cmp-previewtiles__header'],
    },
    {
      id: 'section-categories',
      name: 'Category Browse',
      selector: 'section.vui\\:cmp-categorytilettes',
      style: null,
      blocks: ['cards'],
      defaultContent: ['.vui\\:cmp-categorytilettes__header'],
    },
  ],
};

// PARSER REGISTRY
const parsers = {
  quicklinks: quicklinksParser,
  hero: heroParser,
  cards: cardsParser,
};

// TRANSFORMER REGISTRY
const transformers = [
  cleanupTransformer,
  ...(PAGE_TEMPLATE.sections && PAGE_TEMPLATE.sections.length > 1 ? [sectionsTransformer] : []),
];

/**
 * Execute all page transformers for a specific hook
 */
function executeTransformers(hookName, element, payload) {
  const enhancedPayload = {
    ...payload,
    template: PAGE_TEMPLATE,
  };

  transformers.forEach((transformerFn) => {
    try {
      transformerFn.call(null, hookName, element, enhancedPayload);
    } catch (e) {
      console.error(`Transformer failed at ${hookName}:`, e);
    }
  });
}

/**
 * Find all blocks on the page based on the embedded template configuration
 */
function findBlocksOnPage(document, template) {
  const pageBlocks = [];

  template.blocks.forEach((blockDef) => {
    blockDef.instances.forEach((selector) => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach((element) => {
          pageBlocks.push({
            name: blockDef.name,
            selector,
            element,
            section: blockDef.section || null,
          });
        });
      } catch (e) {
        console.warn(`Block "${blockDef.name}" selector failed: ${selector}`, e);
      }
    });
  });

  console.log(`Found ${pageBlocks.length} block instances on page`);
  return pageBlocks;
}

// EXPORT DEFAULT CONFIGURATION
export default {
  transform: (payload) => {
    const { document, url, html, params } = payload;

    const main = document.body;

    // 1. Execute beforeTransform transformers (initial cleanup)
    executeTransformers('beforeTransform', main, payload);

    // 2. Find blocks on page using embedded template
    const pageBlocks = findBlocksOnPage(document, PAGE_TEMPLATE);

    // 3. Parse each block using registered parsers
    pageBlocks.forEach((block) => {
      const parser = parsers[block.name];
      if (parser) {
        try {
          parser(block.element, { document, url, params });
        } catch (e) {
          console.error(`Failed to parse ${block.name} (${block.selector}):`, e);
        }
      } else {
        console.warn(`No parser found for block: ${block.name}`);
      }
    });

    // 4. Merge cards blocks that share the same parent into single multi-row blocks.
    // Each card was parsed individually, producing separate <table> blocks.
    // First unwrap cards tables from singleton wrapper elements (e.g. category tilettes
    // where each <a> was inside its own wrapper div). Then merge all cards tables
    // that share the same parent into one grid block.

    // 4a. Unwrap cards tables from singleton parent wrappers
    main.querySelectorAll('table').forEach((table) => {
      const header = table.querySelector('tr:first-child th');
      if (header && header.textContent.trim().toLowerCase() === 'cards') {
        const parent = table.parentElement;
        if (parent && parent !== main && parent.children.length === 1) {
          parent.replaceWith(table);
        }
      }
    });

    // 4b. Group cards tables by parent and merge each group
    const allTables = Array.from(main.querySelectorAll('table'));
    const cardsByParent = new Map();
    allTables.forEach((table) => {
      const header = table.querySelector('tr:first-child th');
      if (header && header.textContent.trim().toLowerCase() === 'cards') {
        const parent = table.parentElement;
        if (!cardsByParent.has(parent)) {
          cardsByParent.set(parent, []);
        }
        cardsByParent.get(parent).push(table);
      }
    });

    cardsByParent.forEach((tables) => {
      if (tables.length <= 1) return;
      const firstTable = tables[0];
      for (let i = 1; i < tables.length; i++) {
        const rows = Array.from(tables[i].querySelectorAll('tr'));
        rows.forEach((row, j) => {
          if (j === 0) return; // skip header row
          const target = firstTable.querySelector('tbody') || firstTable;
          target.append(row);
        });
        tables[i].remove();
      }
    });

    // 5. Execute afterTransform transformers (final cleanup + section breaks/metadata)
    executeTransformers('afterTransform', main, payload);

    // 6. Apply WebImporter built-in rules
    const hr = document.createElement('hr');
    main.appendChild(hr);
    WebImporter.rules.createMetadata(main, document);
    WebImporter.rules.transformBackgroundImages(main, document);
    WebImporter.rules.adjustImageUrls(main, url, params.originalURL);

    // -----------------------------------------------------------------------
    // Verizon Image Pipeline (steps 6b–6c)
    //
    // Context: Verizon uses Adobe Scene7 CDN (ss7.vzw.com / s7.vzw.com) with
    // responsive <picture><source> elements. Three issues require post-processing:
    //
    // 1. DA SOURCE HANDLING — Document Authoring (DA) ignores <source> elements
    //    and only uses <img src>. The original <img src> points to the mobile
    //    (-m) variant, so DA would get low-res mobile images. We promote the
    //    desktop (-d) URL from the first <source srcset> to <img src> and strip
    //    all <source> elements. EDS handles responsive delivery independently.
    //
    // 2. DA CASE-SENSITIVITY — Verizon's CDN is fully case-sensitive on image
    //    names. DA lowercases the -D/-T suffix when processing <source> elements
    //    (e.g. Banner-D → Banner-d), which returns a "Image Coming Soon"
    //    placeholder. Stripping <source> elements (step 6b) avoids this since
    //    <img src> preserves case. Affected images: 25Tile-4newiPhone16-D,
    //    Wave_HPM_skinny_Banner-D.
    //
    // 3. URL FORMAT CONSISTENCY — All Scene7 URLs must include an scl= param
    //    for DA to process them consistently. Without it, some images fail in
    //    DA. The webp-alpha format is also unsupported by DA, replaced with webp.
    //
    // 4. PARSER OVERRIDE — The WebImporter framework reconstructs <picture>
    //    elements from the original DOM during HTML serialization, overriding
    //    any parser-level URL normalization. Steps 6b-6c run post-serialization
    //    to ensure the final output has correct URLs.
    //
    // Step order matters: 6b promotes desktop URLs → 6c normalizes all URLs.
    // -----------------------------------------------------------------------

    // 6b. Consolidate <picture> to desktop-only <img>.
    // Promotes the first <source srcset> (desktop URL) to <img src>, then
    // removes all <source> elements. Keeps <picture> wrapper for EDS compat.
    main.querySelectorAll('picture').forEach((picture) => {
      const desktopSource = picture.querySelector('source[srcset]');
      if (desktopSource) {
        const img = picture.querySelector('img');
        if (img) {
          const desktopUrl = desktopSource.getAttribute('srcset').split(' ')[0];
          img.setAttribute('src', desktopUrl);
          picture.querySelectorAll('source').forEach((s) => s.remove());
        }
      }
    });

    // 6c. Normalize all Verizon Scene7 image URLs.
    // - webp-alpha → webp (DA cannot process webp-alpha format)
    // - png-alpha is PRESERVED (needed for quicklinks icons with transparency)
    // - Ensure scl= param exists (DA requires consistent query string format)
    // Runs AFTER 6b so that promoted desktop URLs also get normalized.
    main.querySelectorAll('img[src]').forEach((el) => {
      const val = el.getAttribute('src');
      if (val && val.includes('vzw.com/is/image/')) {
        let fixed = val;
        // Preserve png-alpha (transparency icons) — only convert webp-alpha → webp
        if (fixed.includes('fmt=webp-alpha')) {
          fixed = fixed.replace(/fmt=webp-alpha/g, 'fmt=webp');
        }
        if (!fixed.includes('scl=')) {
          fixed += (fixed.includes('?') ? '&' : '?') + 'scl=2';
        }
        el.setAttribute('src', fixed);
      }
    });

    // 6d. Percent-encode uppercase chars in Scene7 image names.
    // DA lowercases the image-name portion of Scene7 URLs when processing
    // content, but Verizon's CDN is fully case-sensitive — lowercased names
    // return a "Image Coming Soon" placeholder (3,444 bytes).
    //
    // Fix: percent-encode uppercase letters in the image name so that DA's
    // lowercasing doesn't alter them. E.g. "25Tile" → "25%54ile".
    // Hex digits in percent-encoding are case-insensitive (%54 = %54 = 'T'),
    // so lowercasing the encoded URL has no effect. The CDN decodes %54 → T.
    //
    // Only the image name (last path segment before query string) is encoded —
    // the company path "VerizonWireless" must stay literal (403 if lowercased).
    main.querySelectorAll('img[src]').forEach((el) => {
      const src = el.getAttribute('src');
      if (!src || !src.includes('vzw.com/is/image/')) return;

      // Split URL into path (before ?) and query string (after ?)
      const qIdx = src.indexOf('?');
      const pathPart = qIdx >= 0 ? src.substring(0, qIdx) : src;
      const queryPart = qIdx >= 0 ? src.substring(qIdx) : '';

      // Extract the image name — last segment of the path
      const lastSlash = pathPart.lastIndexOf('/');
      if (lastSlash < 0) return;

      const imageName = pathPart.substring(lastSlash + 1);
      // Check if image name has any uppercase characters
      if (imageName === imageName.toLowerCase()) return;

      // Percent-encode uppercase letters: A→%41, B→%42, ..., Z→%5A
      const encoded = imageName.replace(/[A-Z]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
      const newSrc = pathPart.substring(0, lastSlash + 1) + encoded + queryPart;
      el.setAttribute('src', newSrc);
    });

    // 7. Generate sanitized path
    const path = WebImporter.FileUtils.sanitizePath(
      new URL(params.originalURL).pathname.replace(/\/$/, '').replace(/\.html$/, '') || '/index',
    );

    return [{
      element: main,
      path,
      report: {
        title: document.title,
        template: PAGE_TEMPLATE.name,
        blocks: pageBlocks.map((b) => b.name),
      },
    }];
  },
};
