/**
 * backport-medium-posts.mjs
 *
 * Fetches the Medium RSS feed, converts each missing article to a Jekyll
 * markdown post, and downloads all images to public/images/<slug>/.
 *
 * Usage: node scripts/backport-medium-posts.mjs
 * Safe to re-run — skips posts already present via medium_guid frontmatter.
 */

import { XMLParser } from 'fast-xml-parser';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const POSTS_DIR = path.join(REPO_ROOT, '_posts');
const IMAGES_BASE = path.join(REPO_ROOT, 'public', 'images');
const FEED_URL = 'https://medium.com/feed/@pabasaramahindapala';

// Publication display names for the attribution block
const PUB_NAMES = {
  'javascript.plainenglish.io': 'JavaScript in Plain English',
  'towardsdev.com': 'Towards Dev',
  'medium.com': 'Medium',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function pubDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return 'medium.com';
  }
}

function pubPlatformKey(url) {
  const host = pubDomain(url);
  if (host.includes('towardsdev')) return 'towardsdev';
  if (host.includes('plainenglish')) return 'plainenglish';
  return 'medium';
}

function pubDisplayName(url) {
  const host = pubDomain(url);
  for (const [key, name] of Object.entries(PUB_NAMES)) {
    if (host.includes(key.split('.')[0])) return name;
  }
  return 'Medium';
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);
    proto.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlinkSync(destPath);
        downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

function guessExt(url) {
  const clean = url.split('?')[0];
  const ext = path.extname(clean);
  if (ext && ext.length <= 5) return ext;
  return '.jpg';
}

/** Strip tracking/source query params from Medium URLs */
function cleanUrl(url) {
  try {
    const u = new URL(url);
    u.searchParams.delete('source');
    return u.toString();
  } catch {
    return url;
  }
}

/** Extract the short Medium post ID from a guid/URL */
function extractMediumId(raw) {
  const clean = cleanUrl(raw);
  const m = clean.match(/\/p\/([a-f0-9]{12})$/);
  if (m) return m[1];
  const parts = clean.split('/').filter(Boolean);
  const last = parts[parts.length - 1];
  const idMatch = last?.match(/([a-f0-9]{12})$/);
  return idMatch ? idMatch[1] : null;
}

/** Parse the guid field from a fast-xml-parser item (handles attribute objects) */
function parseGuid(rawGuid) {
  if (!rawGuid) return null;
  if (typeof rawGuid === 'string') return rawGuid;
  return rawGuid['#text'] || rawGuid.__cdata || null;
}

/** Collect all existing medium_guid short IDs from _posts/ frontmatter */
function existingGuids() {
  const guids = new Set();
  const slugs = new Set();
  for (const f of fs.readdirSync(POSTS_DIR)) {
    if (!f.endsWith('.md')) continue;
    const content = fs.readFileSync(path.join(POSTS_DIR, f), 'utf8');
    const guidMatch = content.match(/medium_guid:\s*(.+)/);
    if (guidMatch) {
      const id = extractMediumId(guidMatch[1].trim());
      if (id) guids.add(id);
    }
    // Also track slug portion of filename to catch pre-script posts
    const slugPart = f.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.md$/, '');
    slugs.add(slugPart);
  }
  return { guids, slugs };
}

/** Extract plain-text description (~160 chars) from HTML body */
function extractDescription(html) {
  const $ = cheerio.load(html);
  $('figure, figcaption, script, style').remove();
  const text = $.text().replace(/\s+/g, ' ').trim();
  const cut = text.slice(0, 200);
  const lastDot = cut.lastIndexOf('.');
  return (lastDot > 80 ? cut.slice(0, lastDot + 1) : cut.slice(0, 160)).trim();
}

/** Convert <content:encoded> HTML to Jekyll markdown */
async function convertHtml(html, slug) {
  const imgDir = path.join(IMAGES_BASE, slug);
  if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });

  const $ = cheerio.load(html, { decodeEntities: false });

  // Remove Medium junk
  $('style, .graf--pullquote, [data-action="sign-up-prompt"], .u-paddingTop0').remove();

  let imgCounter = 0;
  const imgPromises = [];

  // Process figures / images — download and rewrite
  $('figure').each((_, fig) => {
    const $fig = $(fig);
    const $img = $fig.find('img').first();
    const $cap = $fig.find('figcaption');

    if ($img.length) {
      const src = $img.attr('src') || $img.attr('data-src') || '';
      if (src && !src.startsWith('data:')) {
        imgCounter++;
        const ext = guessExt(src);
        const localName = `image-${imgCounter}${ext}`;
        const localPath = path.join(imgDir, localName);
        const mdPath = `/public/images/${slug}/${localName}`;
        const alt = $img.attr('alt') || '';
        const caption = $cap.text().trim();
        const mdImg = caption
          ? `\n![${alt}](${mdPath} "${caption}")\n`
          : `\n![${alt}](${mdPath})\n`;

        imgPromises.push(downloadFile(src, localPath).catch(() => {
          console.warn(`  ⚠ Failed to download: ${src}`);
        }));

        $fig.replaceWith(mdImg);
      } else {
        $fig.remove();
      }
    } else {
      $fig.remove();
    }
  });

  // Standalone <img> not inside <figure>
  $('img').each((_, el) => {
    const $el = $(el);
    const src = $el.attr('src') || $el.attr('data-src') || '';
    if (src && !src.startsWith('data:')) {
      imgCounter++;
      const ext = guessExt(src);
      const localName = `image-${imgCounter}${ext}`;
      const localPath = path.join(imgDir, localName);
      const mdPath = `/public/images/${slug}/${localName}`;
      const alt = $el.attr('alt') || '';
      imgPromises.push(downloadFile(src, localPath).catch(() => {
        console.warn(`  ⚠ Failed to download: ${src}`);
      }));
      $el.replaceWith(`\n![${alt}](${mdPath})\n`);
    } else {
      $el.remove();
    }
  });

  await Promise.all(imgPromises);

  // Gist iframes → <script> embeds
  $('iframe').each((_, el) => {
    const src = $(el).attr('src') || '';
    if (src.includes('gist.github.com')) {
      // src typically is https://gist.github.com/user/id — add .js
      const jsSrc = src.endsWith('.js') ? src : `${src.replace(/\/$/, '')}.js`;
      $(el).replaceWith(`\n<script src="${jsSrc}"></script>\n`);
    } else {
      $(el).remove();
    }
  });

  // Code blocks
  $('pre').each((_, el) => {
    const $el = $(el);
    const $code = $el.find('code');
    const lang = $code.attr('data-language') || $code.attr('class')?.match(/language-(\w+)/)?.[1] || '';
    const codeText = $code.text();
    $el.replaceWith(`\n\`\`\`${lang}\n${codeText}\n\`\`\`\n`);
  });

  // Headings
  for (let level = 6; level >= 1; level--) {
    $(`h${level}`).each((_, el) => {
      const text = $(el).text().trim();
      $(el).replaceWith(`\n${'#'.repeat(level)} ${text}\n`);
    });
  }

  // Block elements → markdown
  $('blockquote').each((_, el) => {
    const text = $(el).text().trim().split('\n').map(l => `> ${l}`).join('\n');
    $(el).replaceWith(`\n${text}\n`);
  });

  $('hr').each((_, el) => $(el).replaceWith('\n---\n'));

  // Strong / em (inline — must do before stripping tags)
  $('strong, b').each((_, el) => {
    const t = $(el).html();
    $(el).replaceWith(`**${t}**`);
  });
  $('em, i').each((_, el) => {
    const t = $(el).html();
    $(el).replaceWith(`*${t}*`);
  });
  $('code').each((_, el) => {
    const t = $(el).text();
    $(el).replaceWith(`\`${t}\``);
  });

  // Links
  $('a').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href') || '';
    const text = $el.text().trim();
    if (href && text) {
      $el.replaceWith(`[${text}](${href})`);
    } else {
      $el.replaceWith(text);
    }
  });

  // Ordered / unordered lists
  $('ul').each((_, el) => {
    const items = $(el).find('li').map((__, li) => `- ${$(li).text().trim()}`).get();
    $(el).replaceWith(`\n${items.join('\n')}\n`);
  });
  $('ol').each((_, el) => {
    const items = $(el).find('li').map((__, li, i) => `${i + 1}. ${$(li).text().trim()}`).get();
    $(el).replaceWith(`\n${items.join('\n')}\n`);
  });

  // Paragraphs
  $('p').each((_, el) => {
    const inner = $(el).html()?.trim() || '';
    $(el).replaceWith(`\n${inner}\n`);
  });

  // Divs — just unwrap
  $('div').each((_, el) => {
    const inner = $(el).html()?.trim() || '';
    $(el).replaceWith(`\n${inner}\n`);
  });

  // Get final text, clean up excessive blank lines
  let md = $.root().text();
  md = md.replace(/\n{4,}/g, '\n\n').trim();

  return { markdown: md, imageCount: imgCounter };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Fetching Medium RSS feed…');
  const res = await fetch(FEED_URL);
  const xml = await res.text();

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
  const { guids: existingMediumIds, slugs: existingSlugs } = existingGuids();
  console.log(`Found ${allItems.length} feed items. ${existingMediumIds.size} with medium_guid on site.\n`);

  let created = 0;
  let skipped = 0;

  for (const item of allItems) {
    const title = typeof item.title === 'object' ? item.title.__cdata : (item.title || '');
    const link = cleanUrl(item.link || '');
    const pubDate = item.pubDate || '';
    const rawGuid = parseGuid(item.guid) || link;
    const mediumId = extractMediumId(rawGuid);
    const canonicalGuid = mediumId ? `https://medium.com/p/${mediumId}` : rawGuid;

    const categories = item.category
      ? (Array.isArray(item.category) ? item.category : [item.category])
          .map(c => (typeof c === 'object' ? c.__cdata : c))
          .filter(Boolean)
          .map(c => c.toLowerCase())
      : [];

    const date = formatDate(pubDate);
    const slug = slugify(title);
    const filename = `${date}-${slug}.md`;
    const destPath = path.join(POSTS_DIR, filename);

    // Skip if already present by Medium ID, file slug, or file existence
    if (mediumId && existingMediumIds.has(mediumId)) {
      console.log(`SKIP  (guid match) ${title.slice(0, 60)}`);
      skipped++;
      continue;
    }
    if (existingSlugs.has(slug)) {
      console.log(`SKIP  (slug match) ${title.slice(0, 60)}`);
      skipped++;
      continue;
    }
    if (fs.existsSync(destPath)) {
      console.log(`SKIP  (file exists) ${filename}`);
      skipped++;
      continue;
    }

    console.log(`PROCESSING  ${title.slice(0, 60)}`);

    const rawHtml = item['content:encoded']?.__cdata || item['content:encoded'] || '';
    const description = extractDescription(rawHtml);
    const { markdown, imageCount } = await convertHtml(rawHtml, slug);

    const platform = pubPlatformKey(link);
    const pubName = pubDisplayName(link);

    // Special series handling for Asgardeo Part 2
    let seriesLines = '';
    if (title.toLowerCase().includes('asgardeo') && (title.includes('Part 2') || title.includes('part 2'))) {
      seriesLines = `series: asgardeo-remix\nseries_order: 2\n`;
    }

    const frontmatter = `---
layout: post
title: "${title.replace(/"/g, '\\"')}"
published: true
description: "${description.replace(/"/g, '\\"')}"
categories: [${[...new Set(categories)].slice(0, 6).map(c => `${c}`).join(', ')}]
tags: [${[...new Set(categories)].map(c => `${c}`).join(', ')}]
${seriesLines}cross_posts:
  - platform: ${platform}
    url: ${link}
medium_guid: ${canonicalGuid}
---

<div class="message">
    <small>
  This article was originally published on <a href="${link}" target="_blank" rel="noopener noreferrer">${pubName}</a>.
    </small>
</div>

`;

    fs.writeFileSync(destPath, frontmatter + markdown, 'utf8');
    console.log(`  ✓ Created ${filename} (${imageCount} images downloaded)`);
    created++;
  }

  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
