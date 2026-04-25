---
layout: default
title: Projects
permalink: /projects/
description: Open source projects and side work by Pabasara Mahindapala — Angular, Java, Jekyll, and cloud tooling.
---

<div class="page projects-page" itemscope itemtype="https://schema.org/WebPage">
  <h1 class="page-title" itemprop="name">Projects</h1>
  <div class="page-content">

<p>Side projects and open-source work. Most of what I build falls into two camps: tools that fix something annoying I ran into at work, and experiments that let me go deeper on something I wrote about.</p>

  </div>

  <ul class="project-list">
    {% for project in site.data.projects %}
    <li class="project-card">
      <div class="project-header">
        <h2 class="project-name">
          {% if project.url %}
            <a href="{{ project.url }}" target="_blank" rel="noopener noreferrer">{{ project.name }}</a>
          {% else %}
            {{ project.name }}
          {% endif %}
        </h2>
        {% if project.status %}
          <span class="project-status project-status--{{ project.status }}">{{ project.status }}</span>
        {% endif %}
      </div>
      <p class="project-description">{{ project.description }}</p>
      {% if project.tech %}
        <div class="project-tech">
          {% for t in project.tech %}
            <span class="tag-chip">{{ t }}</span>
          {% endfor %}
        </div>
      {% endif %}
      {% if project.url %}
        <a href="{{ project.url }}" target="_blank" rel="noopener noreferrer" class="project-link">View on GitHub ↗</a>
      {% endif %}
    </li>
    {% endfor %}
  </ul>
</div>
