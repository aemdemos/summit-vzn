/**
 * Post-processing script: Percent-encode uppercase chars in Scene7 image names.
 *
 * Problem: DA (Document Authoring) lowercases image names in Scene7 URLs,
 * but Verizon's CDN (ss7.vzw.com / s7.vzw.com) is fully case-sensitive.
 * Lowercased names return a 3,444-byte "Image Coming Soon" placeholder.
 *
 * Fix: Percent-encode uppercase letters in the image name portion of the URL.
 * E.g. "25Tile" → "25%54ile". DA lowercasing doesn't affect percent-encoded
 * chars (%54 stays %54), and the CDN decodes %54 back to T.
 *
 * Must run AFTER the bulk import (which produces content/*.html files),
 * because WebImporter's HTML serializer decodes percent-encoded URLs.
 *
 * IMPORTANT: Also handles .plain.html files where the AEM CLI specifically
 * decodes and lowercases the "-D" responsive suffix (e.g. -%44 → -d).
 * The script cross-references with the .html file to detect and re-encode
 * these lowercased suffixes.
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
  }
});

console.log(`\nTotal: ${totalFixed} fix(es) across processed file(s)`);
