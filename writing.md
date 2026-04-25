---
layout: default
title: Writing
permalink: /writing/
description: All articles by Pabasara Mahindapala - identity, frontend engineering, software architecture, and cloud.
---

<div class="page writing-archive">
  <h1 class="page-title">Writing</h1>

  {% assign all_tags = "" | split: "" %}
  {% for post in site.posts %}
    {% for tag in post.tags %}
      {% unless all_tags contains tag %}
        {% assign all_tags = all_tags | push: tag %}
      {% endunless %}
    {% endfor %}
  {% endfor %}
  {% assign all_tags = all_tags | sort %}

  <div class="tag-filter" id="tag-filter" aria-label="Filter posts by tag">
    <button class="tag-chip tag-filter-btn active" data-tag="all">All</button>
    {% for tag in all_tags %}
      <button class="tag-chip tag-filter-btn" data-tag="{{ tag | slugify }}">{{ tag }}</button>
    {% endfor %}
  </div>

  {% assign postsByYear = site.posts | group_by_exp:"post", "post.date | date: '%Y'" %}
  {% for year_group in postsByYear %}
    <div class="archive-year-group">
      <h2 class="archive-year">{{ year_group.name }}</h2>
      <ul class="post-list">
        {% for post in year_group.items %}
          {% assign post_tag_slugs = "" | split: "" %}
          {% for tag in post.tags %}
            {% assign post_tag_slugs = post_tag_slugs | push: tag | join: " " %}
          {% endfor %}
          <li class="post-card"
              data-tags="{{ post.tags | join: ' ' | slugify: 'pretty' }}"
              itemscope itemtype="https://schema.org/BlogPosting">
            <div class="post-card-meta">
              <span itemprop="datePublished" class="post-date">{{ post.date | date: "%b %-d, %Y" }}</span>
              {% if post.categories %}
                {% for cat in post.categories limit:2 %}
                  <span class="tag-chip">{{ cat }}</span>
                {% endfor %}
              {% endif %}
              {% if post.cross_posts %}
                {% for cp in post.cross_posts %}
                  <a href="{{ cp.url }}" target="_blank" rel="noopener noreferrer" class="platform-badge">{{ cp.platform }} ↗</a>
                {% endfor %}
              {% endif %}
            </div>
            <h2 class="post-card-title">
              <a itemprop="url" href="{{ post.url }}">
                <span itemprop="headline">{{ post.title }}</span>
              </a>
            </h2>
            {% if post.description and post.description != post.title %}
              <p class="post-excerpt">{{ post.description }}</p>
            {% else %}
              <p class="post-excerpt">{{ post.excerpt | strip_html | truncatewords: 35 }}</p>
            {% endif %}
          </li>
        {% endfor %}
      </ul>
    </div>
  {% endfor %}

  <p class="archive-count">{{ site.posts | size }} articles total</p>
</div>

<script>
(function () {
  var btns = document.querySelectorAll('.tag-filter-btn');
  var cards = document.querySelectorAll('.post-card[data-tags]');
  var yearGroups = document.querySelectorAll('.archive-year-group');

  btns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      btns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');

      var selected = btn.getAttribute('data-tag');

      if (selected === 'all') {
        cards.forEach(function (c) { c.style.display = ''; });
      } else {
        cards.forEach(function (c) {
          var tags = c.getAttribute('data-tags') || '';
          c.style.display = tags.indexOf(selected) !== -1 ? '' : 'none';
        });
      }

      yearGroups.forEach(function (g) {
        var visible = g.querySelectorAll('.post-card:not([style*="display: none"])');
        g.style.display = visible.length === 0 ? 'none' : '';
      });
    });
  });
})();
</script>
