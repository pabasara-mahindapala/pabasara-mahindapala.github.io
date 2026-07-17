---
layout: post
title: "How the Upcoming MCP Auth Spec Tightens Up (PKCE Won't Save You)"
published: true
description: "The 2026-07-28 MCP authorization release candidate brings six hardening and interoperability fixes: issuer validation, per-issuer credentials, refresh token guidance, and more. Explained in plain terms."
categories: [mcp, oauth, security, identity]
tags: [mcp, oauth, security, identity, ai, oauth2, oidc, authorization]
hero: /public/images/mcp-authorization-2026-07-28-changes/hero.jpg
---

![](/public/images/mcp-authorization-2026-07-28-changes/hero.jpg "Photo by Muhammad Zaqy Al Fattah on Unsplash"){: .centered}

*What's changing in the 2026-07-28 MCP authorization spec release and what you should do*

**TL;DR:** The next version of the MCP authorization spec brings six changes: all hardening and interoperability fixes, no redesigns. If you build MCP clients: validate `iss`, store credentials per issuer, declare your `application_type`, and combine your scopes on step-up.

The Model Context Protocol (MCP) has become the standard way for AI applications to connect to external tools and data. It lets an AI assistant plug into your backend, your company's systems, or a coding tool. But every one of those connections raises the same question: how does the tool know the AI is allowed in, and acting on behalf of the right person?

That's the job of **MCP authorization**, a specification built on OAuth 2.1, the same framework that handles countless enterprise logins. The current spec version, 2025-11-25, laid down a solid foundation. The upcoming version, **2026-07-28**, refines it. The release candidate is available, with final publication targeted for July 28th.

None of the six changes redesigns anything. They are hardening and interoperability fixes, and they all trace back to a single structural fact about MCP that's worth understanding first.

## The Problem Underneath All Six Changes

In a traditional app, the relationships are known in advance. Your banking app talks to your bank's servers, which trust your bank's login system. Everything was laid on the table ahead of time.

![One MCP client connecting to many unknown authorization servers](/public/images/mcp-authorization-2026-07-28-changes/diagram-1-fanout.png "One MCP client connecting to many unknown authorization servers"){: .centered}

MCP breaks that assumption. An MCP client might connect to dozens of MCP servers built by different people. Each of them is protected by a different authorization server the client has never encountered before. It could be an enterprise identity provider like [WSO2 Identity Server](https://wso2.com/identity-platform/identity-server/), a SaaS provider like [WSO2 Identity Platform](https://asgardeo.io/signup/), or a custom OAuth server they built themselves.

_The client connects to MCP servers, discovers which server authorizes them, registers itself, and obtains credentials - all happening dynamically._

This **"one client, many unknown authorities"** dynamic is powerful, but it stretches OAuth in ways typical deployments never do. Each of the six changes in this release candidate patches a specific place where that stretch showed.

## 1. Verifying the Issuer

**The change:** Clients must validate the `iss` (issuer) parameter on authorization responses, as defined in RFC 9207.

When you knock on a door and someone answers, you'd like to confirm they actually live there. Because an MCP client deals with many authorization servers, a malicious one could trick the client into handing over a login code meant for an honest server. This is known as a **mix-up attack**. 

To avoid this, before starting the login flow, the client notes exactly which authorization server it intends to talk to. When the response comes back carrying an `iss` label, the client checks that the label matches its note. If it doesn't, the client rejects the response and the login fails.

![How issuer validation stops a mix-up attack](/public/images/mcp-authorization-2026-07-28-changes/diagram-2-mixup.png "How issuer validation stops a mix-up attack"){: .centered}

This is notable because PKCE, the protection most people assume covers this, does not stop mix-up attacks. The client sends its code verifier to whichever token endpoint it was tricked into using. (Read more on how PKCE is involved in MCP auth here: [MCP Server Authentication in .NET](/dotnet/security/authentication/aspnetcore/2026/05/02/mcp-server-oauth2-dotnet/).) 

Today, authorization servers SHOULD emit `iss` - and must advertise it via `authorization_response_iss_parameter_supported` if they do. The spec signals that a future revision is expected to upgrade that to a MUST, so operators are encouraged to start emitting it now.

## 2. Credentials That Don't Transfer Between Authorities

**The change:** Client credentials must be bound to the specific authorization server that issued them, keyed by its issuer identifier.

A gym membership card works just at your gym, not at every gym. If an MCP server changes which authorization server protects it (which can happen when a company migrates identity providers), the client must not keep flashing its old credentials at the new provider. It has to register afresh with the new authority.

![How client credentials are bound to a single authorization server](/public/images/mcp-authorization-2026-07-28-changes/diagram-4-credbinding.png "How client credentials are bound to a single authorization server"){: .centered}

This applies to pre-registered credentials and those obtained via Dynamic Client Registration (DCR). Interestingly, it doesn't apply to [**Client ID Metadata Documents (CIMD)**](https://datatracker.ietf.org/doc/draft-ietf-oauth-client-id-metadata-document/), which is MCP's recommended registration mechanism, where the client ID is a self-hosted HTTPS URL that any authorization server can resolve on demand. CIMD identities are portable by construction, which quietly strengthens the case for using them.

## 3. Telling the Server What Kind of App You Are

**The change:** Clients must declare an OpenID Connect (OIDC) `application_type` when registering dynamically.

Apps can come in two flavors: web apps that live on a server somewhere, and "native" apps that run on localhost: desktop tools, mobile apps, CLIs. These two flavors receive login redirects differently. If a desktop app doesn't mention the type, many identity providers assume "web" by default and then reject the app's legitimate localhost redirect address. The result, until now, was a confusing registration failure. Declaring the type up front fixes this.

![Declaring application_type native lets a loopback redirect register successfully](/public/images/mcp-authorization-2026-07-28-changes/diagram-5-apptype.png "Declaring application_type native lets a loopback redirect register successfully"){: .centered}

Omitting `application_type` defaults to `"web"` under OIDC Dynamic Client Registration, which conflicts with `localhost` redirect URIs. Native-style clients now register with `application_type: "native"`. Servers that don't implement OIDC can ignore the parameter, so the change is backward-compatible.

## 4. Clearer Rules for Token Refresh

**The change:** The spec now documents how to request refresh tokens from OIDC-style authorization servers.

A refresh token is what lets an app stay connected without asking you to log in every hour. Different identity providers handle this differently: some issue them automatically, others only provide them if you explicitly ask using an `offline_access` scope. Earlier MCP clients had no guidance on navigating this split, leading to inconsistent behavior.

Now clients should include `refresh_token` in their registered grant types, and they may add `offline_access` to the scope when the authorization server advertises it. The client must never assume a refresh token will always be issued. Resource servers shouldn't advertise `offline_access` as a required scope, since staying signed in is a client concern, not a resource requirement.

## 5. Asking for More Scopes Without Losing What You Had

**The change:** The spec clarifies how scopes accumulate when a client needs to "step up" its access.

Imagine you have a library card that lets you borrow books, and one day you need access to the archive room. When you go back to the desk to ask, you'd want your new pass to cover *both* the archive *and* your existing borrowing rights, not swap one for the other. 

**The clarified rule:** the server tells the client only what the current operation needs, and the *client* is responsible for combining that with everything it was already granted before re-requesting.

![Scope step-up: the client unions old and new scopes before re-requesting](/public/images/mcp-authorization-2026-07-28-changes/diagram-3-stepup.png "Scope step-up: the client unions old and new scopes before re-requesting"){: .centered}

This keeps servers stateless. They emit per-operation `insufficient_scope` challenges without tracking each client's history, while clients compute the union of previously requested and newly challenged scopes. Servers are also urged to emit all missing scopes for an operation in a single challenge rather than one at a time, so clients can re-request them all at once.

## 6. One Place to Look Up the Authorization Server

**The change:** The spec pins down exactly how clients discover an authorization server's configuration.

Before the two systems can work together, one has to look up the other's details: where to redirect logins, what options are supported. That lookup happens at the standardized "well-known" web addresses. But there were multiple conventions for constructing them, and ambiguity meant lookups could fail between perfectly good implementations. The spec now states the exact URL to use, and the order of precedence if multiple are present.

Now MCP uses the default `oauth-authorization-server` well-known suffix from [RFC 8414](https://datatracker.ietf.org/doc/html/rfc8414) (there's no MCP-specific suffix). It defines a priority order across OAuth and OIDC discovery endpoints for issuers with and without path components. There's also a sharpened validation rule: the `issuer` value inside a fetched metadata document must exactly match the URL it was derived from, or the client must reject it.

## Key Takeaways

When read together, the six changes tell one story: MCP's authorization layer is being tuned to match how OAuth and OIDC are *actually deployed*. This can mean identity providers that default apps to "web", servers that guard refresh tokens behind `offline_access`, or infrastructures that migrate authorization servers mid-flight. There are fewer grand redesigns, but more precise answers to questions raised in real deployments.

If you build MCP clients, the checklist is: **validate `iss`, store credentials per issuer, declare your `application_type`, and combine your scopes on step-up.** If you operate an authorization server, start emitting `iss` and advertising support for it now. The spec has signaled where things are headed, and you need to align with it.

> **Note**: 2026-07-28 is a release candidate until its final publication date, so details may still shift. For the authoritative text, see the [draft authorization specification](https://modelcontextprotocol.io/specification/draft/basic/authorization) and the accompanying changelog.

## Conclusion

MCP's authorization spec is settling into the work of matching real-world OAuth deployments, and that's a good sign. If you're building or securing an MCP integration, the checklist above should help you avoid the pitfalls and make your integrations more robust.
