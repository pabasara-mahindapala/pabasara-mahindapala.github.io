# pabasara-mahindapala.github.io

Personal blog and portfolio of [Pabasara Mahindapala](https://pabasara-mahindapala.github.io). Built with [Jekyll](https://jekyllrb.com) and deployed via GitHub Pages.

## Running locally

```bash
bundle install
bundle exec jekyll serve
```

Open `http://localhost:4000`. To expose on the local network (e.g. for mobile testing):

```bash
bundle exec jekyll serve --host 0.0.0.0
```

Then access from other devices at `http://<your-ip>:4000`. If blocked, add a Windows Firewall inbound rule for TCP port 4000.

## Structure

```
_includes/
  post-card.html       # shared post list item (homepage + archive)
  analytics.html       # GoatCounter analytics (self-hosted count.js)
  head.html            # <head> with SEO meta tags
  nav.html             # top navigation
_layouts/
  default.html         # base layout
  post.html            # single post layout (with series nav)
  page.html            # static page layout
_posts/                # blog posts in YYYY-MM-DD-slug.md format
public/
  css/site.css         # all styles
  count.js             # self-hosted GoatCounter script
  images/              # post images, one folder per post slug
index.html             # homepage (recent writing + currently section)
writing.md             # full post archive with tag filtering
about.md               # about page
```

## Posts

Posts live in `_posts/` as `YYYY-MM-DD-slug.md`. Frontmatter fields:

```yaml
---
layout: post
title: "Post Title"
published: true
description: "One-sentence summary shown in post cards and meta tags."
categories: [category-one, category-two]
tags: [tag-one, tag-two]
cross_posts:
  - platform: medium          # or linkedin, plainenglish, towardsdev
    url: https://...
medium_guid: https://medium.com/p/<id>   # deduplication key for backport script
hero: /public/images/slug/hero.jpg       # optional: pin a specific thumbnail image
# series fields (optional):
series: series-slug
series_order: 1
---
```

Post images go in `/public/images/<post-slug>/`. The first image in a post body is auto-extracted as the thumbnail in post list cards; set `hero:` in frontmatter to override.

## Post cards

The `_includes/post-card.html` include renders each item in the homepage recent writing list and the full archive. It auto-extracts the first body image as a right-side clickable thumbnail. Thumbnails are hidden on screens narrower than 600 px.

The archive page (`writing.md`) passes a `tags_data` parameter to the include to enable client-side tag filtering.

## Series

Posts in a series share a `series:` slug and an incrementing `series_order:`. The `post.html` layout renders a series navigation block automatically when these fields are present.

## Analytics

[GoatCounter](https://www.goatcounter.com) is used for privacy-friendly analytics. The client script is self-hosted at `/public/count.js` (downloaded from `gc.zgo.at/count.js`) to avoid ad blocker blocks on the CDN domain. Refresh the local copy periodically:

```bash
curl -o public/count.js https://gc.zgo.at/count.js
```

## Deployment

Push to the `master` branch. GitHub Pages builds and deploys automatically via Jekyll.
