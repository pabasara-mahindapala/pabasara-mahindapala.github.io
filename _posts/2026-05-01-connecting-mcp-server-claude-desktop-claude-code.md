---
layout: post
title: "Testing Your Local MCP Server with Claude Desktop and Claude Code"
published: false
description: "You've built an MCP server and it's running on localhost. Here's how to point Claude Desktop and Claude Code at it so you can actually test it."
categories: [software-development]
tags: [mcp, claude, claude-code, oauth2, dotnet]
hero: /public/images/connecting-mcp-server-claude-desktop-claude-code/hero.jpg
---

![](/public/images/connecting-mcp-server-claude-desktop-claude-code/hero.jpg "Photo by Unsplash"){: .centered}

You've built an MCP server and it's running on `https://localhost:5001`. Now you want to test it from Claude. The two main clients — Claude Desktop and Claude Code — connect differently.

---

## Claude Desktop — via mcp-remote

Claude Desktop only talks to MCP servers over **STDIO**: it writes to a local process's stdin and reads from stdout. Your server speaks HTTP, so you need a proxy in the middle.

[`mcp-remote`](https://www.npmjs.com/package/mcp-remote) is that proxy:

```
Claude Desktop → (STDIO) → mcp-remote → (HTTPS) → localhost:5001/mcp
```

It's a small Node.js process that Claude Desktop launches locally. On one side it speaks STDIO; on the other it makes HTTP requests to your server. It also handles OAuth automatically — spinning up a local callback server, opening the browser for you to log in, and caching the token so subsequent restarts don't prompt again.

### Configuration

Open `%APPDATA%\Claude\claude_desktop_config.json` (Windows) and add your server:

```json
{
  "mcpServers": {
    "MyApp": {
      "command": "npx",
      "args": ["mcp-remote", "https://localhost:5001/mcp"],
      "env": {
        "NODE_TLS_REJECT_UNAUTHORIZED": "0"
      }
    }
  }
}
```

The `NODE_TLS_REJECT_UNAUTHORIZED=0` flag is needed because your local server is running with a self-signed certificate. Node.js (which `mcp-remote` runs on) rejects self-signed certs by default — this tells it to skip verification. The flag lives in `mcp-remote`'s `env` block because `mcp-remote` is the one making the HTTPS request; Claude Desktop itself never connects directly to your server.

Restart Claude Desktop after saving. On first launch a browser window opens for OAuth login.

> **Don't carry `NODE_TLS_REJECT_UNAUTHORIZED=0` to production.** It disables all certificate verification — any certificate will be trusted, including a malicious one. When you deploy, remove it. If your host is Azure App Service, no TLS config is needed at all: Azure provisions a trusted cert automatically and Node.js trusts it out of the box.

---

## Claude Code — native HTTP

Claude Code understands HTTP transport natively, so no proxy is needed. Register your local server with one command:

```bash
claude mcp add --transport http MyApp https://localhost:5001/mcp
```

Or add it to your project's `.claude/settings.json`:

```json
{
  "mcpServers": {
    "MyApp": {
      "type": "http",
      "url": "https://localhost:5001/mcp"
    }
  }
}
```

Claude Code handles the OAuth flow the same way — browser opens on first use, token is cached, subsequent runs are silent. There is no proxy process, no STDIO bridge, and the config is just a type and a URL.

### Self-signed certificate workaround

Unlike Claude Desktop's command-based entries, HTTP-type MCP entries in `.claude/settings.json` don't have an `env` block, so you can't scope the TLS flag to a single server. Instead, set it in the global `~/.claude/settings.json`:

```json
{
  "env": {
    "NODE_TLS_REJECT_UNAUTHORIZED": "0"
  }
}
```

This sets the flag for the entire Claude Code process rather than for one MCP connection specifically. The same caveat applies: dev only, remove it before pointing at a production server with a real certificate.
