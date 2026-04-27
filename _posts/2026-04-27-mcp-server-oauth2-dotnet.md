---
layout: post
title: "MCP Server Authentication in .NET: Implementing OAuth 2.1 Without a SaaS"
published: true
description: "The MCP spec mandates OAuth 2.1 with PKCE for remote servers. This post walks through implementing the full auth layer in ASP.NET Core — no external Identity Provider required."
categories: [dotnet, security, authentication, aspnetcore]
tags: [dotnet, mcp, oauth2, pkce, security, aspnetcore, identity, csharp, backend]
hero: /public/images/mcp-server-oauth2-dotnet/hero.jpg
---

![](/public/images/mcp-server-oauth2-dotnet/hero.jpg "MCP Server Authentication in .NET: Implementing OAuth 2.1 Without a SaaS")

**TL;DR:** The MCP 2025-11-25 specification mandates OAuth 2.1 with PKCE for remote server authentication. This post walks through implementing the entire auth layer natively in ASP.NET Core — authorization server, dynamic client registration, PKCE verification, and token issuance — no external Identity Provider required.

---

## The Problem: An Unauthenticated MCP Server Is an Open Door

The Model Context Protocol (MCP) lets AI clients like Claude Code call tools on your server. But if your MCP endpoint has no authentication, any client that can reach it can invoke those tools — including destructive ones.

The [MCP 2025-11-25 specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization) addresses this directly: remote MCP servers **must** use OAuth 2.1 to protect their endpoints.

For production systems, the right answer is usually a managed Identity Provider (IdP). Asgardeo, for example, handles the authorization server, dynamic client registration, token management, and refresh rotation out of the box. You configure your app as a resource server, point the `WWW-Authenticate` header at Asgardeo's discovery endpoint, and you're done.

But not every project warrants that overhead. If you're building an internal tool, a self-hosted API, or a smaller app where adding a SaaS IdP is more friction than the problem it solves, you can implement the OAuth 2.1 layer yourself. The spec is precise enough that a well-scoped native implementation is straightforward.

This post covers exactly that.

---

## What the MCP Spec Actually Requires

Before writing any code, it's worth understanding what the spec mandates:

1. **OAuth 2.1** — specifically, the authorization code flow. Implicit and password grants are not allowed.
2. **PKCE** — Proof Key for Code Exchange (S256 method only). This prevents authorization code interception attacks.
3. **Dynamic Client Registration** — MCP clients auto-register before starting the auth flow. Your server must accept `POST /oauth/register` and return a `client_id` on the spot.
4. **Discovery endpoints** — two well-known URLs that tell clients where to find your authorization and token endpoints:
   - `GET /.well-known/oauth-protected-resource`
   - `GET /.well-known/oauth-authorization-server`
5. **A `WWW-Authenticate` header** — when a request arrives at your MCP endpoint without a valid token, your server must respond with `401` and a header that points to the protected resource metadata URL.

Once a client has a valid Bearer token, every subsequent request to `/mcp` must carry it. Your API validates it the same way it validates any JWT — nothing special for MCP there.

---

## Project Setup

The MCP SDK for .NET ([`ModelContextProtocol.AspNetCore`](https://www.nuget.org/packages/ModelContextProtocol.AspNetCore)) handles the protocol transport. Authentication is standard ASP.NET Core JWT Bearer middleware.

```csharp
// Program.cs
builder.Services.AddMcpServer()
    .WithHttpTransport(o => o.Stateless = true)
    .WithToolsFromAssembly();

builder.Services.Configure<OAuthOptions>(
    builder.Configuration.GetSection(OAuthOptions.Section));
builder.Services.AddSingleton<AuthorizationCodeStore>();
```

`WithToolsFromAssembly()` discovers all classes decorated with `[McpServerToolType]` and registers their methods automatically. `Stateless = true` tells the transport layer not to maintain session state between requests — each call is self-contained, which is correct for JWT-authenticated APIs.

```csharp
app.MapMcp("/mcp").RequireAuthorization("McpAccess");
```

The `/mcp` endpoint uses a named policy rather than bare `.RequireAuthorization()`. That distinction matters — without it, any valid JWT issued by this server (including regular app sessions) could call MCP tools. The policy is defined in the authorization setup:

```csharp
services.AddAuthorization(options =>
{
    options.AddPolicy("McpAccess", policy =>
        policy.RequireAuthenticatedUser()
              .RequireClaim("scope", "mcp:tools"));
});
```

`RequireClaim("scope", "mcp:tools")` means only tokens issued through the MCP OAuth flow pass. Tokens from your normal login endpoint don't carry this claim, so they're rejected at the MCP endpoint even if they're otherwise valid.

---

## The 401 Challenge: Pointing Clients to Your Discovery Endpoints

When a client hits `/mcp` without a token, the default JWT Bearer `401` response is not enough. The MCP spec requires the `WWW-Authenticate` header to include a `resource_metadata` URL. Without it, MCP clients don't know where to start the auth flow.

Hook into the JWT Bearer `OnChallenge` event to add it:

```csharp
builder.Services.PostConfigure<JwtBearerOptions>(
    JwtBearerDefaults.AuthenticationScheme, options =>
{
    options.Events ??= new JwtBearerEvents();
    options.Events.OnChallenge = async context =>
    {
        if (!context.HttpContext.Request.Path.StartsWithSegments("/mcp"))
        {
            // Let the default challenge handler run for non-MCP endpoints.
            return;
        }

        context.HandleResponse();
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;

        var issuer = $"{context.Request.Scheme}://{context.Request.Host}";
        var resourceMetadata = $"{issuer}/.well-known/oauth-protected-resource";

        context.Response.Headers["WWW-Authenticate"] =
            $"Bearer realm=\"mcp\", resource_metadata=\"{resourceMetadata}\"";
    };
});
```

`context.HandleResponse()` suppresses the default 401 body and lets you write your own. The `resource_metadata` value is the URL the client will fetch next.

---

## Discovery Endpoints

The client follows the `resource_metadata` URL to learn about your auth server. Two endpoints, minimal logic:

```csharp
[ApiController]
[AllowAnonymous]
[Route(".well-known")]
public class WellKnownController : ControllerBase
{
    [HttpGet("oauth-protected-resource")]
    public IActionResult GetProtectedResourceMetadata()
    {
        var issuer = GetIssuer();
        return Ok(new Dictionary<string, object>
        {
            ["resource"] = $"{issuer}/mcp",
            ["authorization_servers"] = new[] { issuer },
            ["scopes_supported"] = new[] { "mcp:tools" }
        });
    }

    [HttpGet("oauth-authorization-server")]
    public IActionResult GetAuthorizationServerMetadata()
    {
        var issuer = GetIssuer();
        return Ok(new Dictionary<string, object>
        {
            ["issuer"] = issuer,
            ["authorization_endpoint"] = $"{issuer}/oauth/authorize",
            ["token_endpoint"] = $"{issuer}/oauth/token",
            ["registration_endpoint"] = $"{issuer}/oauth/register",
            ["response_types_supported"] = new[] { "code" },
            ["grant_types_supported"] = new[] { "authorization_code", "refresh_token" },
            ["token_endpoint_auth_methods_supported"] = new[] { "none" },
            ["code_challenge_methods_supported"] = new[] { "S256" }
        });
    }

    private string GetIssuer() =>
        $"{Request.Scheme}://{Request.Host}{Request.PathBase}".TrimEnd('/');
}
```

The `authorization_servers` array in the protected resource response tells the client that the same server acts as the authorization server. In a SaaS setup, this would point to the external IdP URL instead.

---

## Dynamic Client Registration

MCP clients don't have pre-configured `client_id` values. They register themselves the first time they connect. Your `POST /oauth/register` endpoint accepts the request and returns a fresh `client_id`:

```csharp
[HttpPost("register")]
public async Task<IActionResult> Register()
{
    string[]? redirectUris = null;

    if (Request.ContentType?.Contains("application/json") == true)
    {
        using var doc = await JsonDocument.ParseAsync(Request.Body);
        if (doc.RootElement.TryGetProperty("redirect_uris", out var urisEl)
            && urisEl.ValueKind == JsonValueKind.Array)
        {
            redirectUris = urisEl.EnumerateArray()
                .Select(u => u.GetString() ?? string.Empty)
                .Where(u => !string.IsNullOrEmpty(u))
                .ToArray();
        }
    }

    var clientId = _authorizationCodeStore.RegisterClient();

    return Ok(new Dictionary<string, object>
    {
        ["client_id"] = clientId,
        ["client_id_issued_at"] = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
        ["token_endpoint_auth_method"] = "none",
        ["grant_types"] = new[] { "authorization_code", "refresh_token" },
        ["response_types"] = new[] { "code" },
        ["redirect_uris"] = redirectUris ?? Array.Empty<string>()
    });
}
```

The `client_id` is a cryptographically random Base64Url string stored in memory. It's not persisted anywhere — if the server restarts, the client will need to register again. For an internal tool, that's an acceptable trade-off.

---

## Authorization Code Flow with PKCE

This is the core of the implementation. The flow has three steps: render the login form, handle the form submission, and exchange the code for tokens.

### Step 1 — Render the Login Form

```csharp
[HttpGet("authorize")]
public IActionResult Authorize(
    [FromQuery(Name = "client_id")] string clientId,
    [FromQuery(Name = "redirect_uri")] string redirectUri,
    [FromQuery(Name = "response_type")] string responseType,
    [FromQuery(Name = "code_challenge")] string codeChallenge,
    [FromQuery(Name = "code_challenge_method")] string codeChallengeMethod,
    [FromQuery] string state,
    [FromQuery] string? scope)
{
    var request = new OAuthAuthorizeRequest(
        clientId, redirectUri, responseType,
        codeChallenge, codeChallengeMethod, state, scope);

    if (!TryValidateAuthorizeRequest(request, out var validationError))
        return BadRequest(validationError);

    return RenderLoginForm(request);
}
```

Validation checks: valid `client_id` (static or dynamically registered), `response_type=code`, `code_challenge_method=S256`, and an allowed `redirect_uri` prefix. If any fail, return `400` — never redirect on a bad request, as that can enable open redirect attacks.

### Step 2 — Handle Credentials and Issue a Code

```csharp
[HttpPost("authorize")]
public async Task<IActionResult> Authorize([FromForm] OAuthLoginForm form)
{
    var request = form.ToAuthorizeRequest();

    if (!TryValidateAuthorizeRequest(request, out var validationError))
        return BadRequest(validationError);

    var loginResult = await _accountUseCase.Login(new LoginCommand
    {
        Email = form.Email,
        Password = form.Password,
        RememberMe = false
    });

    if (loginResult.IsError)
        return RenderLoginForm(request, GetLoginErrorMessage(loginResult));

    var user = await _userManager.FindByIdAsync(loginResult.Payload.UserId);

    var code = _authorizationCodeStore.Create(
        user.Id, request.ClientId, request.RedirectUri, request.CodeChallenge);

    var redirectUrl = BuildRedirectUrl(request.RedirectUri, code, request.State);
    return Redirect(redirectUrl);
}
```

On successful login, generate a one-time authorization code and store it in memory along with the `code_challenge`. The `state` parameter is passed back to the client unchanged — it's the client's CSRF protection.

### Step 3 — Exchange the Code for Tokens

```csharp
private async Task<IActionResult> ExchangeAuthorizationCode(IFormCollection form)
{
    var code = form["code"].ToString();
    var clientId = form["client_id"].ToString();
    var redirectUri = form["redirect_uri"].ToString();
    var codeVerifier = form["code_verifier"].ToString();

    if (!_authorizationCodeStore.TryConsume(code, out var entry))
        return OAuthError("invalid_grant",
            "Authorization code is invalid or expired.", HttpStatusCode.BadRequest);

    if (entry.ClientId != clientId || entry.RedirectUri != redirectUri)
        return OAuthError("invalid_grant",
            "Authorization code does not match the request.", HttpStatusCode.BadRequest);

    if (!VerifyPkce(codeVerifier, entry.CodeChallenge))
        return OAuthError("invalid_grant",
            "PKCE verification failed.", HttpStatusCode.BadRequest);

    var user = await _userManager.FindByIdAsync(entry.UserId);
    var (accessToken, refreshToken) = await _accountUseCase
        .GenerateAccessAndRefreshTokens(user, scope: "mcp:tools");

    return Ok(BuildTokenResponse(accessToken, refreshToken));
}
```

`TryConsume` removes the code from the store atomically — authorization codes are single-use. Then three checks run in order: the code must belong to the requesting client and redirect URI, and the PKCE verifier must hash to the stored challenge.

```csharp
private static bool VerifyPkce(string codeVerifier, string expectedChallenge)
{
    var challenge = WebEncoders.Base64UrlEncode(
        SHA256.HashData(Encoding.ASCII.GetBytes(codeVerifier)));

    return string.Equals(challenge, expectedChallenge, StringComparison.Ordinal);
}
```

The PKCE check is what makes this attack-resistant. Even if someone intercepts the authorization code in transit, they cannot exchange it without the original `code_verifier` — which only the legitimate client has.

---

## The Authorization Code Store

The in-memory store handles code creation, consumption, and client registration:

```csharp
public class AuthorizationCodeStore
{
    private static readonly TimeSpan CodeLifetime = TimeSpan.FromMinutes(2);
    private static readonly TimeSpan DynamicClientLifetime = TimeSpan.FromHours(24);

    private readonly ConcurrentDictionary<string, AuthorizationCodeEntry> _codes = new();
    private readonly ConcurrentDictionary<string, DateTimeOffset> _dynamicClients = new();

    public string Create(
        string userId, string clientId, string redirectUri, string codeChallenge)
    {
        PruneExpiredEntries();
        var code = GenerateCode();
        _codes[code] = new AuthorizationCodeEntry(
            userId, clientId, redirectUri, codeChallenge,
            DateTimeOffset.UtcNow.Add(CodeLifetime));
        return code;
    }

    public bool TryConsume(string code, out AuthorizationCodeEntry entry)
    {
        if (!_codes.TryRemove(code, out entry))
            return false;

        if (entry.ExpiresAtUtc <= DateTimeOffset.UtcNow)
        {
            entry = default!;
            return false;
        }

        return true;
    }

    public string RegisterClient()
    {
        PruneExpiredDynamicClients();
        var clientId = GenerateCode();
        _dynamicClients[clientId] = DateTimeOffset.UtcNow.Add(DynamicClientLifetime);
        return clientId;
    }

    public bool IsDynamicClient(string clientId) =>
        _dynamicClients.TryGetValue(clientId, out var expiry) && expiry > DateTimeOffset.UtcNow;

    private static string GenerateCode() =>
        WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));

    private void PruneExpiredEntries()
    {
        var now = DateTimeOffset.UtcNow;
        foreach (var pair in _codes)
            if (pair.Value.ExpiresAtUtc <= now)
                _codes.TryRemove(pair.Key, out _);
    }

    private void PruneExpiredDynamicClients()
    {
        var now = DateTimeOffset.UtcNow;
        foreach (var pair in _dynamicClients)
            if (pair.Value <= now)
                _dynamicClients.TryRemove(pair.Key, out _);
    }
}
```

`ConcurrentDictionary` makes the store thread-safe without explicit locking. `TryRemove` is atomic — it handles the race condition where two concurrent requests try to consume the same code.

**Lifetime decisions:**
- Authorization codes: 2-minute TTL. Short enough to limit interception windows, long enough for a user to enter credentials.
- Dynamic client registrations: 24-hour TTL. The dictionary stores the expiry timestamp instead of a boolean, so `IsDynamicClient` can check it inline without a separate sweep. `PruneExpiredDynamicClients` runs before each new registration to keep memory bounded.
- Tokens: issued with whatever lifetime your JWT configuration specifies.

---

## MCP Tools

With auth in place, defining tools is straightforward. The SDK discovers them via `[McpServerToolType]` and `[McpServerTool]`:

```csharp
[McpServerToolType]
public static class VendorsCustomerTools
{
    [McpServerTool, Description("List vendors/customers with optional search and pagination.")]
    public static async Task<VendorsCustomersResponse> GetVendorsCustomers(
        IMediator mediator,
        string? searchText = null,
        int pageNumber = 1,
        int rowsPerPage = 50)
    {
        return Unwrap(await mediator.Send(new GetVendorsCustomersQuery
        {
            SearchText = searchText,
            PageNumber = pageNumber,
            RowsPerPage = rowsPerPage
        }));
    }

    private static T Unwrap<T>(Envelope<T> env)
    {
        if (env.IsError)
            throw new InvalidOperationException(
                $"{env.Title}: {string.Join("; ", env.ValidationErrors
                    .Select(kv => $"{kv.Key}: {kv.Value}"))}");
        return env.Payload;
    }
}
```

Dependencies like `IMediator` are injected directly as method parameters — no constructor or controller needed. The SDK resolves them from the DI container per request.

---

## What Lives in Memory — and What That Means

Authorization codes, dynamic client IDs, and the code-to-entry mapping are all in-memory. A server restart wipes them.

For most internal tools, this is fine. Authorization codes have a 2-minute TTL and dynamic client registrations last 24 hours — so a client that registered earlier in the day can reconnect without re-registering, but after a restart it will need to go through `/oauth/register` again before starting the auth flow.

If you need persistence across restarts, move the store to a database. The interface stays the same — swap `ConcurrentDictionary` for EF Core tables, add an index on the code column, and add a background cleanup job for expired entries. The rest of the implementation doesn't change.

Refresh tokens are already persisted — they're stored in the `AspNetUsers` table and validated on every refresh request. Only the short-lived authorization codes and the ephemeral client registrations are in memory.

---

## When to Use This vs. Asgardeo (or Another IdP)

This implementation covers the MCP spec requirements and works well for:

- Internal APIs where you control both the server and the clients
- Projects already running ASP.NET Core Identity with their own user store
- Teams that want to avoid introducing an external dependency for a non-customer-facing tool

Where a managed IdP earns its place:

- **Multi-application scenarios** — if several services share the same users, a central IdP avoids duplicating auth logic
- **Enterprise SSO** — SAML, SCIM, corporate directory integration are hard to build and easy to get wrong
- **Compliance requirements** — audit logs, token revocation lists, session management at scale

The native approach is a self-contained solution. Adding Asgardeo is a one-way door toward a richer feature set — but it comes with configuration, pricing, and a dependency on an external system. Know which trade-off you're making before committing.

---

## The Full Auth Flow, Step by Step

Here's what happens from the moment a client connects to a working token in hand:

```
Client → GET /mcp
       ← 401  WWW-Authenticate: Bearer resource_metadata="…/.well-known/oauth-protected-resource"

Client → GET /.well-known/oauth-protected-resource
       ← { "authorization_servers": ["http://localhost:5000"] }

Client → GET /.well-known/oauth-authorization-server
       ← { "authorization_endpoint": "…/oauth/authorize",
            "token_endpoint": "…/oauth/token",
            "registration_endpoint": "…/oauth/register" }

Client → POST /oauth/register
       ← { "client_id": "<random>" }

Client opens browser → GET /oauth/authorize?client_id=…&code_challenge=…
User submits credentials → POST /oauth/authorize
       ← 302  redirect_uri?code=<code>&state=<state>

Client → POST /oauth/token  { code, code_verifier, client_id, redirect_uri }
       ← { "access_token": "…", "refresh_token": "…" }

Client → GET /mcp  Authorization: Bearer <access_token>  ✓
```

Each step in this chain is mandated by the MCP 2025-11-25 spec. Skip any one of them and compliant clients will refuse to connect.

---

## Wrapping Up

Implementing OAuth 2.1 natively for an MCP server is more work than pointing at Asgardeo — but it's not as complex as it looks once you break it into its components. The spec is clear, the .NET primitives handle the cryptography, and a few hundred lines of controller code covers the full auth layer.

The key decisions to revisit as your project grows: do you need persistence for auth codes and client registrations, do you need token revocation, and at what point does a managed IdP pay for itself in operational simplicity?

Have you run into any of the edge cases in this flow — particularly around PKCE or dynamic client registration? I'd be curious what broke first.
