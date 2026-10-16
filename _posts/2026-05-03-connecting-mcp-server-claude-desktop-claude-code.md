---
layout: post
title: "Testing Your Local MCP Server with Claude Desktop and Claude Code"
published: true
description: "You've built an MCP server and it's running on localhost. Here's how you can actually test it."
categories: [ai]
redirect_from:
  - /software-development/2026/05/03/connecting-mcp-server-claude-desktop-claude-code/
legacy_id: /software-development/2026/05/03/connecting-mcp-server-claude-desktop-claude-code
tags: [mcp, ai, oauth2, dotnet, claude]
cross_posts:
  - platform: medium
    url: https://medium.com/towardsdev/testing-your-local-mcp-server-with-claude-desktop-and-claude-code-9afef3c76fb4
hero: /public/images/connecting-mcp-server-claude-desktop-claude-code/hero.jpg
---

![](/public/images/connecting-mcp-server-claude-desktop-claude-code/hero.jpg "Photo by Unsplash"){: .centered}

[You've built an MCP server]({% post_url 2026-05-02-mcp-server-oauth2-dotnet %}) and it's running on `https://localhost:5000`. Now you want to test it with a real client. How do you connect it to Claude Desktop or Claude Code?

---

## Claude Desktop

Claude Desktop only supports connecting to MCP servers over **STDIO**: it can write to a local process's stdin and read from stdout. But your MCP server speaks HTTP, so you will need a proxy in the middle.

[`mcp-remote`](https://www.npmjs.com/package/mcp-remote) acts as that proxy:

```
Claude Desktop → (STDIO) → mcp-remote → (HTTPS) → localhost:5000/mcp
```

It's a small Node.js process that Claude Desktop can launch locally. On this side it speaks STDIO; on the other it makes HTTP requests to your server.

It also has OAuth authentication integrated, adds a local callback endpoint, opens the browser for you to log in, and caches the token so subsequent restarts don't prompt again.

### Configuration

Open `%APPDATA%\Claude\claude_desktop_config.json` (Windows) or `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) and add your server, with `npx mcp-remote` as the command and the URL as an argument. Here, you can set the `--transport` flag to `http-only` if your server doesn't communicate via (Server Sent Events) SSE.

```json
{
  "mcpServers": {
    "MyApp": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://localhost:5000/mcp",
        "--transport",
        "http-only"
      ],
      "env": {
        "NODE_EXTRA_CA_CERTS": "/path/to/localhost.crt"
      }
    }
  }
}
```

A local development server usually has a self-signed certificate, and Node.js (which `mcp-remote` runs on) rejects self-signed certs by default. There are two ways around this:

- **`NODE_EXTRA_CA_CERTS` (recommended):** point it to your server's certificate, or the CA that signed it, as a PEM file. Node.js then trusts that certificate in addition to the usual ones, and TLS verification stays on. For the ASP.NET Core development certificate, `dotnet dev-certs https --export-path ./localhost.crt --format PEM` exports it.
- **`NODE_TLS_REJECT_UNAUTHORIZED=0`:** turns TLS verification off completely, so Node.js accepts any certificate. It's quicker to set up, but it also hides real certificate problems. Use it only for a short local test, and remove it afterwards.

The variable lives in `mcp-remote`'s `env` block because `mcp-remote` is the one making the HTTPS request. Note that Claude Desktop itself never connects directly to your server.

Restart Claude Desktop after saving. On first launch a browser window should open for OAuth login.

---

## Claude Code

Claude Code understands HTTP transport natively, so no proxy is needed in this case. You can register your local server with one command:

```bash
claude mcp add --transport http MyApp https://localhost:5000/mcp
```

Or add it to your project's `.claude/settings.json`:

```json
{
  "mcpServers": {
    "MyApp": {
      "type": "http",
      "url": "https://localhost:5000/mcp"
    }
  }
}
```

Claude Code handles the OAuth flow the same way. The browser opens on first use, you authenticate, the token is cached, and subsequent runs are silent. There is no proxy process or STDIO bridge required.

### Self-signed certificates

Unlike Claude Desktop's command-based entries, HTTP-type MCP entries in `.claude/settings.json` don't have an `env` block, so you can't scope a certificate setting to a single server. It applies to the entire Claude Code process instead.

The recommended option is again `NODE_EXTRA_CA_CERTS`. Set it in your shell before starting Claude Code, so Claude Code trusts your server's certificate while TLS verification stays on:

```bash
export NODE_EXTRA_CA_CERTS=/path/to/localhost.crt
claude
```

The alternative is to turn verification off in the global `~/.claude/settings.json`:

```json
{
  "env": {
    "NODE_TLS_REJECT_UNAUTHORIZED": "0"
  }
}
```

Because this turns off TLS verification for every HTTPS connection Claude Code makes, not only your MCP server, use it only for a short local test and remove it afterwards.

That's it! With these configurations, you should be able to test your local MCP server with both Claude Desktop and Claude Code.