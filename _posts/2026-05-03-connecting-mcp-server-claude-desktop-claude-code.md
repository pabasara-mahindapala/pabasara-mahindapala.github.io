---
layout: post
title: "Testing Your Local MCP Server with Claude Desktop and Claude Code"
published: true
description: "You've built an MCP server and it's running on localhost. Here's how you can actually test it."
categories: [software-development]
tags: [mcp, claude, claude-code, oauth2, dotnet]
hero: /public/images/connecting-mcp-server-claude-desktop-claude-code/hero.jpg
---

![](/public/images/connecting-mcp-server-claude-desktop-claude-code/hero.jpg "Photo by Unsplash"){: .centered}

You've built an MCP server and it's running on `https://localhost:5000`. Now you want to test it with a real client. How do you connect it to Claude Desktop or Claude Code?

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
        "NODE_TLS_REJECT_UNAUTHORIZED": "0"
      }
    }
  }
}
```

The `NODE_TLS_REJECT_UNAUTHORIZED=0` flag will be needed for a local development server with a self-signed certificate. Node.js (which `mcp-remote` runs on) rejects self-signed certs by default, and this will ask it to skip the TLS verification. 

The flag lives in `mcp-remote`'s `env` block because `mcp-remote` is the one making the HTTPS request. Note that Claude Desktop itself never connects directly to your server.

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

### Self-signed certificate workaround

Unlike Claude Desktop's command-based entries, HTTP-type MCP entries in `.claude/settings.json` don't have an `env` block, so you can't scope the TLS flag to a single server. Instead, set it in the global `~/.claude/settings.json`:

```json
{
  "env": {
    "NODE_TLS_REJECT_UNAUTHORIZED": "0"
  }
}
```

This sets the flag for the entire Claude Code process rather than for one MCP connection specifically. The same caveat applies: This should be restricted to development only, and you should remove it afterwards.

That's it! With these configurations, you should be able to test your local MCP server with both Claude Desktop and Claude Code.