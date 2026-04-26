/**
 * fix-code-blocks.mjs
 *
 * Medium's RSS feed wraps code in bare <pre> tags using <br> for line breaks
 * (no <code> child). The original backport script only looked for <code>
 * inside <pre>, so all code blocks were written as empty fences.
 *
 * This script re-reads the feed, extracts each <pre> block correctly, and
 * replaces the empty ``` fences in the matching _posts/*.md files.
 *
 * Usage: node scripts/fix-code-blocks.mjs <path-to-feed.xml>
 * Safe to re-run — only touches fences that are currently empty.
 */

import { XMLParser } from 'fast-xml-parser';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const POSTS_DIR = path.join(REPO_ROOT, '_posts');

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
}

/**
 * Extract code blocks from a post's HTML.
 * Medium puts code directly inside <pre> with <br> for newlines.
 * Cheerio's .text() decodes HTML entities automatically.
 */
function extractCodeBlocks(html) {
  const $ = cheerio.load(html);
  const blocks = [];

  $('pre').each((_, el) => {
    const $el = $(el);
    const $code = $el.find('code');

    let lang = '';
    if ($code.length > 0) {
      lang = $code.attr('data-language')
        || $code.attr('class')?.match(/language-(\w+)/)?.[1]
        || '';
      // Replace <br> inside the code element before extracting text
      $code.find('br').each((__, br) => $(br).replaceWith('\n'));
      blocks.push({ lang, code: $code.text().trim() });
    } else {
      // Bare <pre> — Medium's style: replace <br> then get decoded text
      $el.find('br').each((__, br) => $(br).replaceWith('\n'));
      blocks.push({ lang, code: $el.text().trim() });
    }
  });

  return blocks;
}

function findPostFile(slug) {
  for (const f of fs.readdirSync(POSTS_DIR)) {
    if (f.endsWith('.md') && f.includes(slug)) return f;
  }
  return null;
}

/**
 * Replace empty code fences in markdown with real content, in order.
 * "Empty" means the fence opens and closes with nothing (or only whitespace)
 * between them.
 */
function patchMarkdown(content, codeBlocks) {
  let blockIdx = 0;
  let changed = false;

  // Match ``` (optional lang) \n \n ``` — the empty fence pattern
  const patched = content.replace(/^(`{3}\w*)\n\n`{3}$/gm, (match, open) => {
    if (blockIdx >= codeBlocks.length) return match;
    const { lang, code } = codeBlocks[blockIdx++];
    if (!code) return match; // nothing to fill in
    changed = true;
    const fence = lang ? `\`\`\`${lang}` : open; // prefer feed lang hint
    return `${fence}\n${code}\n\`\`\``;
  });

  return { patched, changed, used: blockIdx };
}

async function main() {
  const feedPath = process.argv[2];
  if (!feedPath) {
    console.error('Usage: node scripts/fix-code-blocks.mjs <feed.xml>');
    process.exit(1);
  }

  const xml = fs.readFileSync(feedPath, 'utf8');
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    cdataPropName: '__cdata',
  });
  const feed = parser.parse(xml);
  const items = feed?.rss?.channel?.item;
  if (!items) { console.error('No items in feed.'); process.exit(1); }

  const allItems = Array.isArray(items) ? items : [items];
  let totalPatched = 0;

  for (const item of allItems) {
    const title = typeof item.title === 'object' ? item.title.__cdata : (item.title || '');
    const slug = slugify(title);
    const postFile = findPostFile(slug);
    if (!postFile) continue;

    const rawHtml = item['content:encoded']?.__cdata || item['content:encoded'] || '';
    const codeBlocks = extractCodeBlocks(rawHtml);
    if (codeBlocks.length === 0) continue;

    const postPath = path.join(POSTS_DIR, postFile);
    const original = fs.readFileSync(postPath, 'utf8');
    const { patched, changed, used } = patchMarkdown(original, codeBlocks);

    if (changed) {
      fs.writeFileSync(postPath, patched, 'utf8');
      console.log(`✓ ${postFile} — filled ${used}/${codeBlocks.length} block(s)`);
      totalPatched += used;
    } else {
      console.log(`- ${postFile} — no empty blocks (${codeBlocks.length} in feed)`);
    }
  }

  console.log(`\nDone. Total code blocks filled: ${totalPatched}`);
}

main().catch(err => { console.error(err); process.exit(1); });
