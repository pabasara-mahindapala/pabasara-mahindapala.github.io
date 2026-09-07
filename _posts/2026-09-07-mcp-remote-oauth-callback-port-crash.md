---
layout: post
title: "mcp-remote Crashed When the OAuth Port Was Taken, Here's How I Fixed It"
published: true
description: "An open source contribution to mcp-remote: recovering from EADDRINUSE on the OAuth callback port without silently breaking the registered redirect_uri."
categories: [software-development]
tags: [mcp, oauth2, nodejs, open-source, claude, typescript]
hero: /public/images/mcp-remote-oauth-callback-port-crash/hero.jpg
---

![](/public/images/mcp-remote-oauth-callback-port-crash/hero.jpg "Photo by KC Shum on Unsplash"){: .centered}

*Why a port conflict crashed a package with millions of weekly downloads, and why the obvious fix was not right*

**TL;DR:** A stale process holding a port made `mcp-remote` crash on startup with `EADDRINUSE`. The obvious fix is to grab another port, but that quietly breaks OAuth. Here is why, and what I changed in [PR #262](https://github.com/punkpeye/mcp-remote/pull/262).

## The package

If you have ever connected Claude Desktop to a remote [MCP server](https://modelcontextprotocol.io/docs/2026-07-28/getting-started/intro), you might have run `mcp-remote`.

Most MCP clients only support STDIO to a local process. Remote MCP servers require HTTP and expect a full OAuth flow. `mcp-remote` bridges the gap: it reads STDIO on one side and makes authenticated HTTP requests on the other side. A walkthrough of that setup is available in [Testing Your Local MCP Server with Claude Desktop and Claude Code](/software-development/2026/05/03/connecting-mcp-server-claude-desktop-claude-code/).

It runs a local HTTP server to capture the OAuth redirect, handles the browser authentication flow, and caches the resulting token for reuse.

The scale was impressive when I looked it up. The package has about 2 million downloads per week.

Most usages of the package are simple, define the remote MCP server URL and it's good to go.

```json
{
  "mcpServers": {
    "remote-example": {
      "command": "npx",
      "args": ["mcp-remote", "https://remote.mcp.server/mcp"]
    }
  }
}
```

## OAuth flow

You see that the config above passes no credentials. By default `mcp-remote` registers itself with the authorization server at runtime through [dynamic client registration](https://datatracker.ietf.org/doc/html/rfc7591), gets its `client_id`, and caches it. Nothing needs to be set up in the server.

The package supports several additional flags in the OAuth flow:

- **`--static-oauth-client-info`** hands it a pre-registered `client_id` and `client_secret` directly. Works against a provider that has no dynamic registration.
- **`--static-oauth-client-metadata`**, use this to pin a `scope`, or to override `token_endpoint_auth_method` when the server needs other values.
- **`--client-metadata-url`** uses a [Client ID Metadata Document](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization#overview), where an HTTPS URL is the `client_id`. No registration is required.
- **`--authorize-param key=value`** adds parameters to the authorize request. For example, Google needs `access_type=offline` and `prompt=consent` to issue a refresh token.

A pre-registered client has a `redirect_uri` recorded against it, and a metadata document lists its own `redirect_uris`. The port defined in the redirect URI needs to be the same port that the `mcp-remote` callback server is listening on.

## The crash

The callback port gets cached in `mcp-remote` to keep the OAuth `redirect_uri` stable across runs. On the next launch, `mcp-remote` reads the cached port and binds to it.

However, if a previous process crashed, by force-closing for example, its callback server is still holding that port. The old code called [`app.listen(port)`](https://github.com/punkpeye/mcp-remote/blob/2899e55b43060ae906915b370cce513a9ad160f9/src/lib/utils.ts#L663) with no `'error'` handler.

When a port conflicts, the old code crashed with `EADDRINUSE`.

```log
[40217] Using existing client port: 28233
[40217] Authentication required. Initializing auth...

Error: listen EADDRINUSE: address already in use 127.0.0.1:28233
```

Since there was no recovery path, the only options were to hunt down the conflicting Node process, or manually edit your MCP config to use a different port. For anyone who did not know how it worked and the tool spawned a web server at all, it looked like the integration itself was broken. Nick Youngblut reported it as [issue #253](https://github.com/punkpeye/mcp-remote/issues/253).

## The obvious fix is wrong

The tempting one-liner is to catch the error and bind port `0`, letting the operating system assign a random port.

But that produces a working listener and a broken login.

The port is baked into the `redirect_uri` that was registered with the authorization server, and OAuth requires that value to match exactly at the token exchange. Rebinding makes the failure surface later, somewhere far from where the problem started.

So the fix has to answer a harder question than "is this port free?". It has to decide whether the port is mandatory or incidental.

## The fix

The change wraps `app.listen()` in a promise with an `'error'` handler, and splits on `strictPort`:

```typescript
httpServer.once('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    if (options.strictPort) {
      reject(/* actionable error naming the port */)
      return
    }
    log(`Warning: callback port ${options.port} is already in use, falling back to a random port`)
    const fallback = app.listen(0, '127.0.0.1')
    fallback.once('listening', () => {
      const addr = fallback.address() as AddressInfo
      resolve({ server: fallback, actualPort: addr.port })
    })
  } else {
    reject(err)
  }
})
```

See [`src/lib/utils.ts`](https://github.com/punkpeye/mcp-remote/blob/38f2e8b2ec7448c6f327e2583643bb35577e2c16/src/lib/utils.ts#L672-L708).

[`strictPort`](https://github.com/punkpeye/mcp-remote/blob/38f2e8b2ec7448c6f327e2583643bb35577e2c16/src/lib/types.ts#L57) is true when the user passed an explicit `[callback-port]` argument, or when `--static-oauth-client-info` is being used. Those are the cases where someone has told the authorization server what the exact redirect URI is. Rebinding to a different port would not work here. So it is set to [fail with a message naming the port](https://github.com/punkpeye/mcp-remote/blob/38f2e8b2ec7448c6f327e2583643bb35577e2c16/src/lib/utils.ts#L678-L688) and why it is mandatory.

Otherwise the port was incidental, and the code repairs the situation. The real bound port travels back up through [`coordinateAuth`](https://github.com/punkpeye/mcp-remote/blob/38f2e8b2ec7448c6f327e2583643bb35577e2c16/src/lib/coordination.ts#L168) as `actualPort`. The provider's `redirect_uri` is corrected through a new [`setCallbackPort()`](https://github.com/punkpeye/mcp-remote/blob/38f2e8b2ec7448c6f327e2583643bb35577e2c16/src/lib/node-oauth-client-provider.ts#L59). If dynamic registration is in use, the [cached `client_info.json` is cleared](https://github.com/punkpeye/mcp-remote/blob/38f2e8b2ec7448c6f327e2583643bb35577e2c16/src/proxy.ts#L98) so the client can re-register with the actual address.

[Three tests](https://github.com/punkpeye/mcp-remote/blob/38f2e8b2ec7448c6f327e2583643bb35577e2c16/src/lib/utils.test.ts#L1030-L1086) cover the changes from the fix: `actualPort` matching the bound port, the fallback when the requested port is busy, and the rejection under `strictPort`.

Note that this fix is for the recovery, not complete prevention. A process that dies unexpectedly can still leave its callback server behind, and this change lets the `mcp-remote` client survive that without breaking.

The change merged on 21 August 2026 and shipped in `0.1.39`.

## Conclusion

The bug was larger than a missing error handler. The fix was mostly about noticing that a resource can be unavailable for different reasons, and the correct fix depends on whether that resource is part of an already established contract.
