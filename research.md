---
layout: default
title: Research
permalink: /research/
description: Research by Pabasara Mahindapala, including the AIRC 2026 Best Paper on sovereign management of NHS patient data on AWS.
---

<div class="page research-page" itemscope itemtype="https://schema.org/WebPage">
  <h1 class="page-title" itemprop="name">Research</h1>
  <div class="page-content">

<p>Most of my work happens in industry, helping teams secure and integrate their systems. Some questions deserve a slower, more rigorous answer, where research comes in.</p>

<p class="research-orcid">
  <a href="{{ site.author.orcid }}" target="_blank" rel="noopener noreferrer">
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#A6CE39"/><text x="12" y="16" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" font-weight="700" fill="#fff">iD</text></svg>
    ORCID: {{ site.author.orcid | remove: "https://orcid.org/" }}
  </a>
  <a href="{{ site.author.scholar }}" target="_blank" rel="noopener noreferrer">
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#4285F4"/><path d="M12 5.5 4.5 10 12 14.5 19.5 10z" fill="#fff"/><path d="M7.5 12.2v3.1c0 1.2 2 2.2 4.5 2.2s4.5-1 4.5-2.2v-3.1L12 14.9z" fill="#fff"/></svg>
    Google Scholar
  </a>
</p>

  </div>

  <ul class="project-list research-list">
    {% for item in site.data.research %}
    <li class="project-card research-card">
      {% if item.status or item.award %}
      <div class="project-header">
        {% if item.status %}<span class="project-status project-status--active">{{ item.status }}</span>{% endif %}
        {% if item.award %}<span class="platform-badge">{{ item.award }}</span>{% endif %}
      </div>
      {% endif %}
      <h2 class="project-name">{{ item.title }}</h2>
      <p class="research-meta">
        {% if item.authors %}
          {% for author in item.authors %}{% if author contains 'Mahindapala' %}<strong>{{ author }}</strong>{% else %}{{ author }}{% endif %}{% unless forloop.last %}, {% endunless %}{% endfor %}
          <br>
        {% endif %}
        <em>{{ item.venue }}</em>,
        {% if item.date %}{{ item.date | date: "%-d %B %Y" }}{% else %}{{ item.year }}{% endif %}{% if item.isbn %}. ISBN {{ item.isbn }}{% endif %}
      </p>
      <p class="project-description">{{ item.summary }}</p>
      {% if item.points %}
        <ul class="research-points">
          {% for point in item.points %}<li>{{ point }}</li>{% endfor %}
        </ul>
      {% endif %}
      {% if item.keywords %}
        <div class="project-tech">
          {% for k in item.keywords %}<span class="tag-chip">{{ k }}</span>{% endfor %}
        </div>
      {% endif %}
      {% if item.links %}
        <div class="project-links">
          {% for link in item.links %}<a href="{{ link.url }}" target="_blank" rel="noopener noreferrer" class="project-link">{{ link.label }} ↗</a>{% endfor %}
        </div>
      {% endif %}
      {% if item.bibtex %}
        <details class="research-cite">
          <summary>Cite (BibTeX)</summary>
          <pre><code>{{ item.bibtex | escape }}</code></pre>
        </details>
      {% endif %}
    </li>
    {% endfor %}
  </ul>
</div>

{% for item in site.data.research %}{% if item.status == 'published' %}
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "ScholarlyArticle",
  "headline": {{ item.title | jsonify }},
  "author": [{% for author in item.authors %}{% if author contains 'Mahindapala' %}{ "@id": "{{ site.url }}/#person" }{% else %}{ "@type": "Person", "name": {{ author | jsonify }} }{% endif %}{% unless forloop.last %}, {% endunless %}{% endfor %}],
  "datePublished": "{{ item.date | date: '%Y-%m-%d' }}",
  "isPartOf": { "@type": "Book", "name": {{ item.venue | jsonify }}, "isbn": {{ item.isbn | jsonify }} },
  "keywords": {{ item.keywords | join: ", " | jsonify }}{% if item.award %},
  "award": {{ item.award | jsonify }}{% endif %}
}
</script>
{% endif %}{% endfor %}
