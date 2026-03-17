/* eslint-disable */
/* global WebImporter */

// PARSER IMPORTS
import heroParser from './parsers/hero.js';
import cardsParser from './parsers/cards.js';

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
