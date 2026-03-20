/**
 * Post-processing script for keeping .html and .plain.html in sync.
 *
 * Fixes two issues the AEM CLI introduces when generating .plain.html:
 *
 * 1. Scene7 URL case-sensitivity:
 *    DA lowercases image names in Scene7 URLs, but Verizon's CDN
 *    (ss7.vzw.com / s7.vzw.com) is fully case-sensitive. Lowercased
 *    names return a placeholder image. Fix: percent-encode uppercase
 *    letters (e.g. "25Tile" → "25%54ile") so they survive lowercasing.
 *    Also re-encodes the "-D" responsive suffix that AEM CLI decodes.
 *
 * 2. Block variant class stripping:
 *    The AEM CLI strips variant classes from block divs in .plain.html
 *    (e.g. class="cards hero-marquee" → class="cards"). This causes
 *    variant-specific CSS and JS to not apply. Fix: sync variant classes
 *    from .html back to .plain.html by matching blocks in document order.
 *
 * Must run AFTER the bulk import (which produces content/*.html files),
 * because WebImporter's HTML serializer decodes percent-encoded URLs.
 *
 * Usage: node postprocess-scene7-urls.js <html-file> [<html-file> ...]
 *   Automatically detects and processes companion .plain.html files.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const SCENE7_PATTERN = /(https?:\/\/s(?:s7|7)\.vzw\.com\/is\/image\/VerizonWireless\/)([^?"&\s]+)/g;

function encodeUppercase(imageName) {
  return imageName.replace(/[A-Z]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
}

/**
 * Build a map of encoded image names from an already-processed .html file.
 * Key = lowercased+decoded version, Value = encoded version.
 * Used to fix .plain.html where the AEM CLI may have decoded/lowercased suffixes.
 */
function buildEncodedMap(htmlContent) {
  const map = new Map();
  let match;
  const pattern = new RegExp(SCENE7_PATTERN.source, 'g');
  while ((match = pattern.exec(htmlContent)) !== null) {
    const encoded = match[2];
    // Decode percent-encoded chars to get the "raw" name, then lowercase it
    const decoded = encoded.replace(/%([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    const lowered = decoded.toLowerCase();
    map.set(lowered, encoded);
  }
  return map;
}

function processHtmlFile(file) {
  let html = readFileSync(file, 'utf-8');
  let count = 0;

  html = html.replace(SCENE7_PATTERN, (match, prefix, imageName) => {
    if (imageName === imageName.toLowerCase()) return match;
    count += 1;
    return prefix + encodeUppercase(imageName);
  });

  if (count > 0) {
    writeFileSync(file, html, 'utf-8');
    console.log(`  ${file}: encoded ${count} case-sensitive image name(s)`);
  } else {
    console.log(`  ${file}: no case-sensitive image names found`);
  }
  return count;
}

/**
 * Sync block variant classes from .html to .plain.html.
 *
 * The AEM CLI strips variant classes when generating .plain.html
 * (e.g. class="cards hero-marquee" becomes class="cards").
 * This function restores them by matching blocks in document order
 * within each base block name.
 */
function syncVariantClasses(plainFile, htmlFile) {
  const htmlContent = readFileSync(htmlFile, 'utf-8');
  let plainContent = readFileSync(plainFile, 'utf-8');

  // Match class attributes that look like block names (lowercase, with optional variants)
  const classPattern = /class="([a-z][a-z0-9-]*(?:\s+[a-z][a-z0-9-]*)*)"/g;

  // Build ordered list of class values per base block name from .html
  const htmlClassMap = new Map();
  let match;
  while ((match = classPattern.exec(htmlContent)) !== null) {
    const base = match[1].split(/\s+/)[0];
    if (!htmlClassMap.has(base)) htmlClassMap.set(base, []);
    htmlClassMap.get(base).push(match[1]);
  }

  // Track position per base class as we walk through .plain.html
  const positionMap = new Map();
  let count = 0;

  plainContent = plainContent.replace(classPattern, (full, classValue) => {
    const base = classValue.split(/\s+/)[0];
    const pos = positionMap.get(base) || 0;
    positionMap.set(base, pos + 1);

    const htmlVariants = htmlClassMap.get(base);
    if (htmlVariants && pos < htmlVariants.length) {
      const expected = htmlVariants[pos];
      if (expected !== classValue) {
        count += 1;
        return `class="${expected}"`;
      }
    }
    return full;
  });

  if (count > 0) {
    writeFileSync(plainFile, plainContent, 'utf-8');
    console.log(`  ${plainFile}: synced ${count} variant class(es) from .html`);
  } else {
    console.log(`  ${plainFile}: all variant classes already in sync`);
  }
  return count;
}

function processPlainHtml(plainFile, encodedMap) {
  let html = readFileSync(plainFile, 'utf-8');
  let count = 0;

  html = html.replace(SCENE7_PATTERN, (match, prefix, imageName) => {
    // Decode the current name to get the raw version
    const decoded = imageName.replace(/%([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    const lowered = decoded.toLowerCase();

    // Look up the correct encoded version from the .html file
    const correctEncoded = encodedMap.get(lowered);
    if (correctEncoded && correctEncoded !== imageName) {
      count += 1;
      return prefix + correctEncoded;
    }
    return match;
  });

  if (count > 0) {
    writeFileSync(plainFile, html, 'utf-8');
    console.log(`  ${plainFile}: fixed ${count} image name(s) from .html reference`);
  } else {
    console.log(`  ${plainFile}: no fixes needed`);
  }
  return count;
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: node postprocess-scene7-urls.js <html-file> [...]');
  process.exit(1);
}

let totalFixed = 0;
files.forEach((file) => {
  console.log(`Processing: ${file}`);

  // Step 1: Encode uppercase chars in the .html file
  totalFixed += processHtmlFile(file);

  // Step 2: Fix companion .plain.html using the encoded .html as reference
  const plainFile = file.replace(/\.html$/, '.plain.html');
  if (plainFile !== file && existsSync(plainFile)) {
    const encodedHtml = readFileSync(file, 'utf-8');
    const encodedMap = buildEncodedMap(encodedHtml);
    totalFixed += processPlainHtml(plainFile, encodedMap);

    // Step 3: Sync block variant classes from .html → .plain.html
    totalFixed += syncVariantClasses(plainFile, file);
  }
});

console.log(`\nTotal: ${totalFixed} fix(es) across processed file(s)`);
