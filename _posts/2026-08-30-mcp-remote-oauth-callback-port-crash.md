---
layout: post
title: "Why mcp-remote Crashed When the OAuth Port Was Taken"
published: true
description: "An open source contribution to mcp-remote: recovering from EADDRINUSE on the OAuth callback port without silently breaking the registered redirect_uri."
categories: [software-development]
tags: [mcp, oauth2, nodejs, open-source, claude, typescript]
hero: /public/images/mcp-remote-oauth-callback-port-crash/hero.jpg
---

![](/public/images/mcp-remote-oauth-callback-port-crash/hero.jpg "Photo by KC Shum on Unsplash"){: .centered}

*Why a busy port crashed a package with millions of weekly downloads, and why the obvious fix quietly breaks OAuth*

**TL;DR:** A stale process holding a port made *mcp-remote* crash on startup with `EADDRINUSE`. The obvious fix is to grab another port, but that quietly breaks OAuth. Here is why, and what I changed in [PR #262](https://github.com/punkpeye/mcp-remote/pull/262).

## The package sitting in the middle

If you have ever connected Claude Desktop to a remote MCP server, you have run *mcp-remote*, probably without thinking about it.

The reason is a transport mismatch. Most MCP clients only speak STDIO to a local process. Remote MCP servers speak HTTP and expect a full OAuth flow. *mcp-remote* sits between them: a small Node.js process that reads STDIO on one side and makes authenticated HTTP requests on the other. I walked through that setup in [Testing Your Local MCP Server with Claude Desktop and Claude Code](/software-development/2026/05/03/connecting-mcp-server-claude-desktop-claude-code/).

It is doing more than forwarding bytes. It runs a local HTTP server to catch the OAuth redirect, opens your browser, and caches the resulting token so restarts stay quiet.

The scale surprised me when I looked it up. The package pulled **512,579 downloads in the week of 14 August 2026**, just before this fix landed. Two weeks later it was pulling almost **3 million a week**, and 4.8 million over the trailing month. The repository has around 1,570 stars.

What makes those numbers unusual is the shape of the canonical config that every MCP server vendor publishes:

```json
{
  "mcpServers": {
    "remote-example": {
      "command": "npx",
      "args": ["mcp-remote", "https://remote.mcp.server/sse"]
    }
  }
}
```

That `npx` is unpinned. Most of those downloads are real process launches resolving to `latest`, not cache hits in CI. A bug here reaches people who never chose to install the package, and a fix reaches them without anyone upgrading anything.

The README, at the time of the fix, called the package "a working proof-of-concept" that you should delete once your client supports remote servers natively. That day had not arrived. Half a million weekly launches were running through the proof-of-concept.

## How much of the OAuth flow you can pin down

The config above passes no credentials, and that is the interesting part. By default *mcp-remote* registers itself with the authorization server at runtime through [dynamic client registration](https://datatracker.ietf.org/doc/html/rfc7591), gets a `client_id` back, and caches it. Nothing to set up, which is why the copy-paste config is three lines.

Plenty of authorization servers do not allow that. Registration is encouraged by the MCP spec, not required, and most enterprise identity providers want a client created ahead of time by an administrator. So the package offers several ways to supply the parts it would otherwise negotiate:

- **`--static-oauth-client-info`** hands it a pre-registered `client_id` and `client_secret` directly, as JSON or an `@`-prefixed file path. This is the flag you reach for against a provider that has no dynamic registration at all.
- **`--static-oauth-client-metadata`** does not replace registration, it merges over the defaults. Use it to pin a `scope`, or to override `token_endpoint_auth_method` when the server needs something other than the one *mcp-remote* infers from `token_endpoint_auth_methods_supported`.
- **`--client-metadata-url`** uses a [Client ID Metadata Document](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization), where an HTTPS URL you host *is* the `client_id`. No registration, no secret, and the document itself declares the redirect URIs you will use.
- **`--authorize-param key=value`** adds parameters to the authorize request. Google needs `access_type=offline` and `prompt=consent` before it will issue a refresh token, and Auth0 needs `audience=https://your-api` to return a JWT instead of an opaque token.

Notice what all of these have in common. Each one moves a value out of runtime negotiation and into something registered in advance, by hand, somewhere you do not control.

That includes the callback URL. A pre-registered client has a `redirect_uri` recorded against it, and a metadata document lists its `redirect_uris` explicitly. The port in that URL stops being a local detail the moment any of this is in play. It becomes half of an agreement with a server that will refuse the token exchange if the other half does not match.

Keep that in mind for the next two sections.

## The crash

The callback port gets cached, because the OAuth `redirect_uri` has to stay stable across runs. On the next launch, *mcp-remote* reads the cached port and binds to it.

If a previous process died badly, force-closing Claude Desktop for example, its callback server is still holding that port. The old code called [`app.listen(port)`](https://github.com/punkpeye/mcp-remote/blob/2899e55b43060ae906915b370cce513a9ad160f9/src/lib/utils.ts#L663) with no `'error'` handler:

```
[40217] Using existing client port: 28233
[40217] Authentication required. Initializing auth...

Error: listen EADDRINUSE: address already in use 127.0.0.1:28233
```

There was no recovery path. Your options were to hunt down an orphaned Node process you did not know existed, or hand-edit your MCP config to pin a different port. For anyone who did not know the tool spawns a web server at all, it looked like the integration itself was broken. Nick Youngblut reported it as [issue #253](https://github.com/punkpeye/mcp-remote/issues/253).

## The obvious fix is wrong

The tempting one-liner is to catch the error and bind port `0`, letting the operating system hand you a free one.

That produces a working listener and a broken login.

The port is not an implementation detail here. It is baked into the `redirect_uri` that was registered with the authorization server, and OAuth requires that value to match exactly at the token exchange. Rebinding silently is like moving house without telling anyone. The letters still go to the old address, and the failure surfaces later, somewhere far from the cause.

So the fix has to answer a harder question than "is this port free?". It has to ask **whether this particular port is load-bearing**.

## Two paths, decided by intent

The change wraps `app.listen()` in a promise with a real `'error'` handler, and splits on `strictPort`:

```ts
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

Abridged from [`src/lib/utils.ts`](https://github.com/punkpeye/mcp-remote/blob/38f2e8b2ec7448c6f327e2583643bb35577e2c16/src/lib/utils.ts#L672-L708).

[`strictPort`](https://github.com/punkpeye/mcp-remote/blob/38f2e8b2ec7448c6f327e2583643bb35577e2c16/src/lib/types.ts#L57) is true when the user passed an explicit `[callback-port]` argument, or when `--static-oauth-client-info` is in use. Those are exactly the cases from the section above: someone has already told an authorization server what the redirect URI is. Rebinding would break an agreement the code cannot see. So they now [fail loudly with a message naming the port](https://github.com/punkpeye/mcp-remote/blob/38f2e8b2ec7448c6f327e2583643bb35577e2c16/src/lib/utils.ts#L678-L688) and why it is mandatory.

Otherwise the port was incidental, and the code repairs the state that assumed it. The real bound port travels back up through [`coordinateAuth`](https://github.com/punkpeye/mcp-remote/blob/38f2e8b2ec7448c6f327e2583643bb35577e2c16/src/lib/coordination.ts#L168) as `actualPort`. The provider's `redirect_uri` is corrected through a new [`setCallbackPort()`](https://github.com/punkpeye/mcp-remote/blob/38f2e8b2ec7448c6f327e2583643bb35577e2c16/src/lib/node-oauth-client-provider.ts#L59). If dynamic registration is in use, the [cached `client_info.json` is cleared](https://github.com/punkpeye/mcp-remote/blob/38f2e8b2ec7448c6f327e2583643bb35577e2c16/src/proxy.ts#L98) so the SDK re-registers with the address that actually exists.

Most of the 166 added lines are that plumbing. The interesting part is the branch. [Three tests](https://github.com/punkpeye/mcp-remote/blob/38f2e8b2ec7448c6f327e2583643bb35577e2c16/src/lib/utils.test.ts#L1030-L1086) cover it: `actualPort` matching the bound port, the fallback when the requested port is busy, and the rejection under `strictPort`.

## What it does not fix

⚠️ This is recovery, not prevention. A process that dies badly can still leave its callback server behind, and the change lets you survive that rather than avoid it. The sibling race conditions in issues #245, #169 and #141 are separate failures and remain open.

The change merged on 21 August 2026 and shipped in `0.1.39`.

The project has since changed hands. It now lives at [punkpeye/mcp-remote](https://github.com/punkpeye/mcp-remote), the version has gone from `0.1.x` to `0.8.x` in a week, and the proof-of-concept warning is gone from the README. Every code link above is pinned to the commit that merged, so they still show the change as it landed.

The branch itself outlived my version of it. `strictPort` has moved out of `utils.ts`, and the default port is now derived from the server URL, so each server gets a stable one of its own. A third reason to treat a port as load-bearing has been added: `--client-metadata-url`. A Client ID Metadata Document has to list its redirect URIs, so the same argument applies. The README now states the rule as documented behaviour: a port you pass explicitly implies a `redirect_uri` the authorization server has already been given, so the tool fails rather than quietly moving.

## Conclusion

The bug was a missing error handler. The fix was mostly about noticing that a resource can be unavailable for two different reasons, and that only one of them is safe to route around.

That distinction shows up well beyond port binding. Retry logic, cache invalidation and fallback defaults all get written as though the resource is interchangeable, and the ones that hurt are the cases where it was part of a contract someone else is still holding.

Have you hit a fallback that worked perfectly and broke something three layers away? I would like to hear about it in the comments.
