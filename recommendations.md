---
layout: default
title: Recommendations
permalink: /recommendations/
description: Recommendations for Pabasara Mahindapala from clients, managers, and teammates, on integration, API, and software engineering work.
---

<div class="page recommendations-page" itemscope itemtype="https://schema.org/WebPage">
  <h1 class="page-title" itemprop="name">Recommendations</h1>
  <div class="page-content">

<p>What people I have worked with say.</p>

  </div>

  <p class="rec-source">
    <a href="{{ site.author.linkedIn }}details/recommendations/" target="_blank" rel="noopener noreferrer">See on LinkedIn ↗</a>
  </p>

  <ul class="rec-list">
    {% for rec in site.data.recommendations %}
    <li class="rec-card" id="{{ rec.id }}">
      <figure>
        <blockquote class="rec-quote">
          {% for para in rec.text %}<p>{{ para }}</p>{% endfor %}
        </blockquote>
        <figcaption class="rec-byline">
          <span class="rec-name">{{ rec.name }}</span>
          <span class="rec-role">{{ rec.role | escape }}</span>
          <span class="rec-meta">{{ rec.date | date: "%B %Y" }}</span>
        </figcaption>
      </figure>
    </li>
    {% endfor %}
  </ul>

</div>
