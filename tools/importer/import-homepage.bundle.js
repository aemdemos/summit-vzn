var CustomImportScript = (() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // tools/importer/import-homepage.js
  var import_homepage_exports = {};
  __export(import_homepage_exports, {
    default: () => import_homepage_default
  });

  // tools/importer/parsers/hero.js
  function parse(element, { document }) {
    var _a, _b, _c;
    const picture = element.querySelector("picture");
    let heroImage = null;
    if (picture) {
      const source = picture.querySelector("source[srcset]");
      const img = picture.querySelector("img");
      const imgSrc = (img == null ? void 0 : img.getAttribute("src")) || source && ((_c = (_b = (_a = source.getAttribute("srcset")) == null ? void 0 : _a.split(",")[0]) == null ? void 0 : _b.trim()) == null ? void 0 : _c.split(" ")[0]) || (img == null ? void 0 : img.src);
      if (imgSrc) {
        heroImage = document.createElement("img");
        heroImage.src = imgSrc;
        heroImage.alt = (img == null ? void 0 : img.alt) || "";
      }
    }
    const heading = element.querySelector("h1, h2");
    const descriptions = Array.from(element.querySelectorAll("p")).filter((p) => {
      const isTooltip = p.closest('[class*="tooltip"]');
      const isDisclaimer = p.closest('[class*="border-top"]');
      return !isTooltip && !isDisclaimer;
    });
    const ctaLinks = Array.from(element.querySelectorAll('a[class*="vui:button"]'));
    const cells = [];
    if (heroImage) {
      cells.push([heroImage]);
    }
    const contentDiv = document.createElement("div");
    if (heading) {
      contentDiv.append(heading);
    }
    descriptions.forEach((desc) => {
      if (desc.textContent.trim()) {
        contentDiv.append(desc);
      }
    });
    ctaLinks.forEach((link) => {
      const p = document.createElement("p");
      p.append(link);
      contentDiv.append(p);
    });
    if (contentDiv.childNodes.length > 0) {
      cells.push([contentDiv]);
    }
    const block = WebImporter.Blocks.createBlock(document, { name: "hero", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/cards.js
  function parse2(element, { document }) {
    var _a, _b, _c;
    const picture = element.querySelector("picture");
    const standaloneImg = element.querySelector("img");
    let imageEl = null;
    if (picture) {
      const source = picture.querySelector("source[srcset]");
      const img = picture.querySelector("img");
      const imgSrc = (img == null ? void 0 : img.getAttribute("src")) || source && ((_c = (_b = (_a = source.getAttribute("srcset")) == null ? void 0 : _a.split(",")[0]) == null ? void 0 : _b.trim()) == null ? void 0 : _c.split(" ")[0]) || (img == null ? void 0 : img.src);
      if (imgSrc) {
        imageEl = document.createElement("img");
        imageEl.src = imgSrc;
        imageEl.alt = (img == null ? void 0 : img.alt) || "";
      }
    } else if (standaloneImg && (standaloneImg.getAttribute("src") || standaloneImg.src)) {
      imageEl = document.createElement("img");
      imageEl.src = standaloneImg.getAttribute("src") || standaloneImg.src;
      imageEl.alt = standaloneImg.alt || "";
    }
    const heading = element.querySelector("h1, h2, h3, h4");
    const descriptions = Array.from(element.querySelectorAll("p")).filter((p) => {
      return !p.closest('[class*="tooltip"]');
    });
    const ctaLink = element.querySelector(
      'a[class*="vui:button"], a[class*="tile__anchor"], a[class*="categorytilettes__anchor"], a[class*="previewtiles__button"]'
    );
    const textDiv = document.createElement("div");
    if (heading) {
      textDiv.append(heading);
    } else if (ctaLink && ctaLink.textContent.trim()) {
      const h = document.createElement("h3");
      h.textContent = ctaLink.textContent.trim();
      textDiv.append(h);
    }
    descriptions.forEach((desc) => {
      if (desc.textContent.trim()) {
        textDiv.append(desc);
      }
    });
    if (ctaLink && ctaLink.href) {
      const p = document.createElement("p");
      const a = document.createElement("a");
      a.href = ctaLink.href;
      const linkText = ctaLink.textContent.trim();
      if (linkText) {
        a.textContent = linkText;
      } else if (heading) {
        a.textContent = heading.textContent.trim();
      } else {
        a.textContent = "Learn more";
      }
      p.append(a);
      textDiv.append(p);
    }
    const cells = [];
    if (imageEl && textDiv.childNodes.length > 0) {
      cells.push([imageEl, textDiv]);
    } else if (textDiv.childNodes.length > 0) {
      cells.push([document.createTextNode(""), textDiv]);
    }
    const block = WebImporter.Blocks.createBlock(document, { name: "cards", cells });
    element.replaceWith(block);
  }

  // tools/importer/transformers/verizon-cleanup.js
  var TransformHook = { beforeTransform: "beforeTransform", afterTransform: "afterTransform" };
  function transform(hookName, element, payload) {
    if (hookName === TransformHook.beforeTransform) {
      WebImporter.DOMUtils.remove(element, [
        ".vui\\:tooltip__trigger-wrap",
        "button.vui\\:tooltip__trigger"
      ]);
      element.querySelectorAll('[style*="overflow: hidden"]').forEach((el) => {
        el.style.overflow = "";
      });
    }
    if (hookName === TransformHook.afterTransform) {
      WebImporter.DOMUtils.remove(element, [
        // Header navigation - <header id="vz-gh20">
        "header#vz-gh20",
        "header",
        // Footer - <footer id="vz-gf20">
        "footer#vz-gf20",
        "footer",
        // Quick links navigation pills - <section id="quickLinks-pzn">
        "section#quickLinks-pzn",
        // Script/tracking elements
        "script",
        "noscript",
        "link",
        "iframe",
        // Evolv experimentation overlay
        '[class*="evolv"]'
      ]);
      element.querySelectorAll("img").forEach((img) => {
        const src = img.getAttribute("src") || "";
        if (src.includes("innovid.com") || src.includes("bat.bing.com") || src.includes("analytics.twitter.com") || src.includes("t.co/") || src.includes("1x1.gif") || src.includes("doubleclick.net") || src.includes("facebook.com/tr") || src.includes("qualtrics.com")) {
          img.remove();
        }
      });
      element.querySelectorAll("p").forEach((p) => {
        if (!p.textContent.trim() && !p.querySelector("img, a, picture")) {
          p.remove();
        }
      });
      element.querySelectorAll('button, [class*="show-more"]').forEach((el) => {
        if (el.textContent.trim().toLowerCase().includes("show more")) {
          el.remove();
        }
      });
      element.querySelectorAll("*").forEach((el) => {
        el.removeAttribute("data-track");
        el.removeAttribute("data-sitecat-cta");
        el.removeAttribute("data-sitecat-level");
        el.removeAttribute("data-sitecat-position");
        el.removeAttribute("onclick");
      });
    }
  }

  // tools/importer/transformers/verizon-sections.js
  var TransformHook2 = { beforeTransform: "beforeTransform", afterTransform: "afterTransform" };
  function transform2(hookName, element, payload) {
    if (hookName === TransformHook2.afterTransform) {
      const { template } = payload;
      if (!template || !template.sections || template.sections.length < 2) return;
      const { document } = element.ownerDocument ? { document: element.ownerDocument } : { document: element.getRootNode() };
      const sections = template.sections;
      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        const selectors = Array.isArray(section.selector) ? section.selector : [section.selector];
        let sectionEl = null;
        for (const sel of selectors) {
          try {
            sectionEl = element.querySelector(sel);
          } catch (e) {
          }
          if (sectionEl) break;
        }
        if (!sectionEl) continue;
        if (section.style) {
          const metadataBlock = WebImporter.Blocks.createBlock(document, {
            name: "Section Metadata",
            cells: { style: section.style }
          });
          sectionEl.after(metadataBlock);
        }
        if (i > 0) {
          const hr = document.createElement("hr");
          sectionEl.before(hr);
        }
      }
    }
  }

  // tools/importer/import-homepage.js
  var PAGE_TEMPLATE = {
    name: "homepage",
    urls: ["https://www.verizon.com/"],
    description: "Verizon homepage with hero carousel, deals grid, service cards, and category navigation",
    blocks: [
      {
        name: "hero",
        instances: [".vui\\:cmp-marqueelayout__tile-1"]
      },
      {
        name: "cards",
        instances: [
          ".vui\\:cmp-marqueelayout__tile-2, .vui\\:cmp-marqueelayout__tile-3",
          ".vui\\:fed__deals-tile",
          ".vui\\:cmp-previewtiles__tile",
          ".vui\\:cmp-categorytilettes__tilette"
        ]
      },
      {
        name: "hero",
        instances: [".vui\\:cmp-marqueelayout__skinny-banner"],
        section: "red"
      }
    ],
    sections: [
      {
        id: "section-hero",
        name: "Hero Marquee Layout",
        selector: "section.vui\\:cmp-marqueelayout",
        style: null,
        blocks: ["hero", "cards"],
        defaultContent: []
      },
      {
        id: "section-5g-banner",
        name: "5G Network Banner",
        selector: ".vui\\:cmp-marqueelayout__skinny-banner",
        style: "red",
        blocks: ["hero"],
        defaultContent: []
      },
      {
        id: "section-deals",
        name: "Deals & Discounts",
        selector: "section#deals-discount",
        style: null,
        blocks: ["cards"],
        defaultContent: ["#deals-discount h2"]
      },
      {
        id: "section-services",
        name: "Stay Connected & Save",
        selector: "section.vui\\:cmp-previewtiles",
        style: null,
        blocks: ["cards"],
        defaultContent: [".vui\\:cmp-previewtiles__header"]
      },
      {
        id: "section-categories",
        name: "Category Browse",
        selector: "section.vui\\:cmp-categorytilettes",
        style: null,
        blocks: ["cards"],
        defaultContent: [".vui\\:cmp-categorytilettes__header"]
      }
    ]
  };
  var parsers = {
    hero: parse,
    cards: parse2
  };
  var transformers = [
    transform,
    ...PAGE_TEMPLATE.sections && PAGE_TEMPLATE.sections.length > 1 ? [transform2] : []
  ];
  function executeTransformers(hookName, element, payload) {
    const enhancedPayload = __spreadProps(__spreadValues({}, payload), {
      template: PAGE_TEMPLATE
    });
    transformers.forEach((transformerFn) => {
      try {
        transformerFn.call(null, hookName, element, enhancedPayload);
      } catch (e) {
        console.error(`Transformer failed at ${hookName}:`, e);
      }
    });
  }
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
              section: blockDef.section || null
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
  var import_homepage_default = {
    transform: (payload) => {
      const { document, url, html, params } = payload;
      const main = document.body;
      executeTransformers("beforeTransform", main, payload);
      const pageBlocks = findBlocksOnPage(document, PAGE_TEMPLATE);
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
      main.querySelectorAll("table").forEach((table) => {
        const header = table.querySelector("tr:first-child th");
        if (header && header.textContent.trim().toLowerCase() === "cards") {
          const parent = table.parentElement;
          if (parent && parent !== main && parent.children.length === 1) {
            parent.replaceWith(table);
          }
        }
      });
      const allTables = Array.from(main.querySelectorAll("table"));
      const cardsByParent = /* @__PURE__ */ new Map();
      allTables.forEach((table) => {
        const header = table.querySelector("tr:first-child th");
        if (header && header.textContent.trim().toLowerCase() === "cards") {
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
          const rows = Array.from(tables[i].querySelectorAll("tr"));
          rows.forEach((row, j) => {
            if (j === 0) return;
            const target = firstTable.querySelector("tbody") || firstTable;
            target.append(row);
          });
          tables[i].remove();
        }
      });
      executeTransformers("afterTransform", main, payload);
      const hr = document.createElement("hr");
      main.appendChild(hr);
      WebImporter.rules.createMetadata(main, document);
      WebImporter.rules.transformBackgroundImages(main, document);
      WebImporter.rules.adjustImageUrls(main, url, params.originalURL);
      const path = WebImporter.FileUtils.sanitizePath(
        new URL(params.originalURL).pathname.replace(/\/$/, "").replace(/\.html$/, "") || "/index"
      );
      return [{
        element: main,
        path,
        report: {
          title: document.title,
          template: PAGE_TEMPLATE.name,
          blocks: pageBlocks.map((b) => b.name)
        }
      }];
    }
  };
  return __toCommonJS(import_homepage_exports);
})();
