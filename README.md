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
  post-card.html       # post list item (homepage only; writing.md inlines its own copy)
  analytics.html       # GoatCounter analytics (self-hosted count.js)
  head.html            # <head> with SEO meta tags
  nav.html             # top navigation
  footer.html          # site footer
  currently.html       # "currently" section on the homepage
  share-page.html      # share links on posts
  disqus.html          # comments
_layouts/
  default.html         # base layout
  post.html            # single post layout (with series nav)
  page.html            # static page layout
_posts/                # blog posts in YYYY-MM-DD-slug.md format
public/
  css/site.css         # all styles
  count.js             # self-hosted GoatCounter script
  og-default.png       # fallback social preview image
  images/              # post images, one folder per post slug
scripts/               # Node helpers (Medium backport, image + code-block fixups)
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
hero: /public/images/slug/hero.jpg       # optional: social preview image (og:image + JSON-LD)
# series fields (optional):
series: series-slug
series_order: 1
---
```

Post images go in `/public/images/<post-slug>/`.

`hero:` does not appear in the post body or in list cards. It sets the Open Graph and Twitter preview image in `_includes/head.html`, and the `image` field of the JSON-LD blob in `_layouts/post.html`. When it is omitted, both fall back to `/public/og-default.png`. Reference images inside the post body with normal markdown, adding `{: .centered}` to center one.

## Post cards

Cards are text only: date, up to two category chips, any `cross_posts` badges, title, and a summary. The summary is the `description` field, falling back to the first 35 words of the post body when `description` is missing or identical to the title. There are no thumbnails anywhere in the post lists.

Two separate implementations render these cards, so a change to card markup has to be made in both places:

- `_includes/post-card.html` is used by `index.html` only, for the recent writing list.
- `writing.md` inlines its own near-identical copy of the same markup, because each archive card needs a `data-tags` attribute that the include does not emit.

Tag filtering on the archive is client-side. `writing.md` collects every tag across `site.posts` into a row of filter buttons, stamps each card with `data-tags`, and a small inline script shows or hides cards on click, hiding any year group left empty.

## Series

Posts in a series share a `series:` slug and an incrementing `series_order:`. The `post.html` layout renders a series navigation block automatically when these fields are present.

## Analytics

[GoatCounter](https://www.goatcounter.com) is used for privacy-friendly analytics. The client script is self-hosted at `/public/count.js` (downloaded from `gc.zgo.at/count.js`) to avoid ad blocker blocks on the CDN domain. Refresh the local copy periodically:

```bash
curl -o public/count.js https://gc.zgo.at/count.js
```

## Deployment

Push to the `master` branch. GitHub Pages builds and deploys automatically via Jekyll.
