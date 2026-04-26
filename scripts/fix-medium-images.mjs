/**
 * fix-medium-images.mjs
 *
 * Re-downloads Medium CDN images that were saved as Cloudflare HTML challenge
 * pages instead of real image data (the original backport script had no
 * browser User-Agent, so the CDN returned a bot-protection page).
 *
 * For each existing backported post the script:
 *   1. Re-fetches the RSS feed to get the original image URLs (in order).
 *   2. Checks each local image file — if it starts with "<!DOCTYPE" it is
 *      corrupted and needs replacing.
 *   3. Re-downloads with browser-like headers so the CDN serves the real image.
 *
 * Usage: node scripts/fix-medium-images.mjs [path-to-feed.xml]
 * Safe to re-run — skips files that are already valid images.
 *
 * Pass a local feed.xml path to avoid Cloudflare blocking the live feed URL.
 * Example: node scripts/fix-medium-images.mjs C:/path/to/feed.xml
 */

import { XMLParser } from 'fast-xml-parser';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const IMAGES_BASE = path.join(REPO_ROOT, 'public', 'images');
const FEED_URL = 'https://medium.com/feed/@pabasaramahindapala';

// Browser-like headers — the missing piece in the original script.
// The Referer: medium.com header is what convinces the CDN to serve images.
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://medium.com/',
};

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
}

function guessExt(url) {
  const clean = url.split('?')[0];
  const ext = path.extname(clean);
  if (ext && ext.length <= 5) return ext;
  return '.jpg';
}

function isCorrupted(filePath) {
  if (!fs.existsSync(filePath)) return true;
  const buf = Buffer.alloc(16);
  const fd = fs.openSync(filePath, 'r');
  const bytesRead = fs.readSync(fd, buf, 0, 16, 0);
  fs.closeSync(fd);
  if (bytesRead === 0) return true; // zero-byte file
  const hex = buf.slice(0, bytesRead).toString('hex');
  const text = buf.slice(0, bytesRead).toString('ascii');
  // HTML challenge pages
  if (text.startsWith('<!') || text.startsWith('<h') || text.startsWith('<H')) return true;
  // Known-good image magic bytes
  const isJpeg = hex.startsWith('ffd8ff');
  const isPng  = hex.startsWith('89504e47');
  const isGif  = hex.startsWith('47494638');
  const isWebP = hex.startsWith('52494646');
  return !(isJpeg || isPng || isGif || isWebP);
}

async function downloadImage(url, destPath) {
  // cdn-images-1.medium.com is rate-limited; miro.medium.com serves the same assets
  const effectiveUrl = url.replace('cdn-images-1.medium.com', 'miro.medium.com');
  const res = await fetch(effectiveUrl, { headers: BROWSER_HEADERS, redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${effectiveUrl}`);
  }
  const buf = await res.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(buf));
}

function extractImageUrls(html) {
  const $ = cheerio.load(html, { decodeEntities: false });
  const urls = [];

  $('figure').each((_, fig) => {
    const $img = $(fig).find('img').first();
    const src = $img.attr('src') || $img.attr('data-src') || '';
    if (src && !src.startsWith('data:')) urls.push(src);
  });

  $('img').each((_, el) => {
    // Skip images already captured inside a figure
    if ($(el).closest('figure').length) return;
    const src = $(el).attr('src') || $(el).attr('data-src') || '';
    // Skip Medium tracking pixels
    if (src && !src.startsWith('data:') && !src.includes('medium.com/_/stat')) urls.push(src);
  });

  return urls;
}

async function main() {
  const localFeedPath = process.argv[2];
  let xml;
  if (localFeedPath) {
    console.log(`Reading feed from ${localFeedPath}…`);
    xml = fs.readFileSync(localFeedPath, 'utf8');
  } else {
    console.log('Fetching Medium RSS feed…');
    const feedRes = await fetch(FEED_URL, { headers: { 'User-Agent': BROWSER_HEADERS['User-Agent'] } });
    xml = await feedRes.text();
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    cdataPropName: '__cdata',
  });
  const feed = parser.parse(xml);
  const items = feed?.rss?.channel?.item;
  if (!items) {
    console.error('No items found in feed.');
    process.exit(1);
  }

  const allItems = Array.isArray(items) ? items : [items];
  let fixed = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of allItems) {
    const title = typeof item.title === 'object' ? item.title.__cdata : (item.title || '');
    const slug = slugify(title);
    const imgDir = path.join(IMAGES_BASE, slug);

    if (!fs.existsSync(imgDir)) continue;

    const rawHtml = item['content:encoded']?.__cdata || item['content:encoded'] || '';
    const imageUrls = extractImageUrls(rawHtml);

    if (imageUrls.length === 0) continue;

    console.log(`\nChecking: ${title.slice(0, 60)}`);

    for (let i = 0; i < imageUrls.length; i++) {
      const ext = guessExt(imageUrls[i]);
      const localName = `image-${i + 1}${ext}`;
      const localPath = path.join(imgDir, localName);

      if (!isCorrupted(localPath)) {
        console.log(`  ✓ ${localName} — OK`);
        skipped++;
        continue;
      }

      console.log(`  ✗ ${localName} — corrupted, re-downloading…`);
      try {
        await downloadImage(imageUrls[i], localPath);
        console.log(`  ✓ ${localName} — fixed`);
        fixed++;
      } catch (err) {
        console.warn(`  ⚠ ${localName} — failed: ${err.message}`);
        failed++;
      }
    }
  }

  console.log(`\nDone. Fixed: ${fixed}, Already OK: ${skipped}, Failed: ${failed}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
