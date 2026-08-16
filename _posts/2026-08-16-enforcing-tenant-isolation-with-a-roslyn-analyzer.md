---
layout: post
title: "Business Rules Don't Have to Live in a Wiki Page: Enforcing Them with a Roslyn Analyzer"
published: true
description: "A business rule that lived only in developers' memory, pushed down into the compiler with a .NET Roslyn analyzer that warns on every rule violation"
categories: [dotnet, security, authorization, aspnetcore]
tags:
  [dotnet, roslyn, analyzers, security, authorization, multitenancy, aspnetcore, csharp, backend]
hero: /public/images/enforcing-tenant-isolation-with-a-roslyn-analyzer/hero.jpg
---

![](/public/images/enforcing-tenant-isolation-with-a-roslyn-analyzer/hero.jpg "Photo by David Magalhães on Unsplash"){: .centered}

*How a .NET Roslyn analyzer moves a business-specific guardrail from developer memory into every build*

Every codebase accumulates rules the compiler knows nothing about.

For example, money always goes through the `Money` type, never a raw decimal. Entities are constructed through their factory, not by hand. Endpoints return a DTO, never an entity straight out of the ORM.

These rules are load-bearing. Breaking one rarely produces a compiler complaint or a failing test, and the resulting code usually looks perfectly reasonable to a reviewer. So how do you actually enforce a rule your programming language knows nothing about?

Most teams keep them in a wiki page, an onboarding session, or a reminder pinned in the team channel. All of those enforce a rule the same way: by hoping people remember it. That works until the person who remembers is on leave, or is in a hurry, or left last year.

This is how you can stop relying on memory to enforce the rules that matter.

---

## A Sample Scenario: Two Layers of Authorization

The rest of this article works through one sample scenario end to end.

Picture a multi-tenant platform: an ASP.NET Core application (.NET 8, MediatR for the request pipeline). Every tenant represents a "business," and a single user can have roles across several businesses. So authorization has two distinct questions to answer on every request:

1. **Can this user perform this action at all?** (e.g. "Read a report," "Add an invoice," "Delete a user")
2. **Can they perform it *for this specific business*?** (the business ID sitting in the request)

Question 1 is action-level. Question 2 is resource-level, and it's the one that actually enforces tenant isolation. Get it wrong and a user who legitimately manages *their* business can reach into *someone else's*.

Consider both questions are handled by an ASP.NET custom authorization attribute, and the resource-level check is on by default:

```csharp
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public class BusinessAuthorizeAttribute : Attribute, IAsyncAuthorizationFilter
{
    // Layer 1: does the user hold this capability at all?
    public string Action { get; set; }
    public string Feature { get; set; }

    // Layer 2: scope that capability to the business in the request.
    // On unless a call site turns it off.
    public bool CheckAgainstBusinessInRequest { get; set; } = true;

    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        // ... resolve the user, handle the super-admin bypass, etc.

        var businessId = await GetBusinessIdFromRequest(context.HttpContext);

        var hasPermission = await _permissions.CheckAsync(
            userId,
            CheckAgainstBusinessInRequest ? businessId : null,  // <-- the crux
            Action,
            Feature);

        if (!hasPermission)
            throw new ForbiddenAccessException();
    }
}
```

The third argument to the `CheckAsync` method is where tenant isolation lives:

- Pass the business ID, and the check asks: *"Does this user hold `{Action}` on `{Feature}` **for this exact business**?"*
- Pass `null`, and it asks the much weaker question: *"Does this user hold `{Action}` on `{Feature}` for **any** business at all?"*

Note what happens when a request carries no business ID at all. `GetBusinessIdFromRequest` returns null, the check falls back to the general capability question, and the endpoint works normally. A `DeleteInvoice(string id)` action needs no special handling, which matters later.

---

## Why an Opt-Out Would Exist

`CheckAgainstBusinessInRequest = false` disables the resource-level check even when the request *does* carry a business ID. That sounds like a footgun with no purpose, and it would be, except that a handful of operations genuinely need it.

The clearest case is a cross-business report. A user with access to several businesses opens a consolidated view, the request names one business as the anchor for the report, and the handler itself filters the results down to the businesses the caller is allowed to see. Applying the above attribute's `CheckAgainstBusinessInRequest` check as well would reject perfectly legitimate requests.

One more example is an endpoint where the business ID in the request identifies something other than the tenant being authorized. In each case the opt-out is correct, and each endpoint carries this decision that only a human can make.

---

## The Trap

Here are two endpoints. They look almost identical. Only one is safe.

```csharp
// Safe: the default scopes the check to the business in the request.
[BusinessAuthorize(Action = "Add", Feature = "Invoices")]
public Task<IActionResult> CreateInvoice(CreateInvoiceCommand request) =>
    Mediator.Send(request);

// The trap: the request carries a BusinessId, but the check was turned off.
[BusinessAuthorize(Action = "Add", Feature = "Invoices",
                   CheckAgainstBusinessInRequest = false)]
public Task<IActionResult> CreateInvoice(CreateInvoiceCommand request) =>
    Mediator.Send(request);
```

Where the command carries the tenant identity:

```csharp
public class CreateInvoiceCommand : IRequest<Envelope<CreateInvoiceResponse>>
{
    public string BusinessId { get; set; }
    // ... invoice fields
}
```

In the second version, a user who has the "Add Invoices" capability for *their own* business can send a request with a **different** business's ID in the body. Layer 1 passes, because they do hold "Add Invoices" *somewhere*. But since Layer 2 has been switched off, nobody checks whether they hold it for the business they named. The command handler then happily writes an invoice into a tenant the caller was never entitled to.

This is textbook **broken object-level authorization**, a cross-tenant IDOR. It's the kind of bug that is invisible in a typical demo, invisible in a happy-path unit test, and only shows up when someone goes looking.

The uncomfortable part is how such a line gets written in the first place. Nobody sets out to disable tenant isolation. What happens is that a developer hits a confusing 403 while building a feature, finds an attribute property that sounds related, sets it to `false`, watches the error disappear, and moves on. The change is small, deliberate, and confident.

Which brings us to the real question: where do you put a rule so that nobody can skip it?

---

## Where Do You Put a Rule So It Can't Be Skipped?

**Developer's Memory** is where a rule like this starts out. Every convention that isn't enforced somewhere else ends up here by default.

**Documentation** is memory with a URL. It's genuinely useful for explaining *why*, and it is read approximately once, during onboarding, and then never again at the moment it matters.

**Code review** is better, because a second pair of eyes sees the diff. But reviewers are inconsistent by nature. They catch the thing they're primed to look for, and one extra property on an attribute that's already there is not what anyone is scanning for.

But something sits even deeper: the **compiler**. It's the one thing in the workflow that nobody can forget to invoke, because you cannot produce a running application without it.

![Roslyn](/public/images/enforcing-tenant-isolation-with-a-roslyn-analyzer/roslyn.png "https://en.wikipedia.org/wiki/Roslyn_(compiler)"){: .centered}

## What a Roslyn Analyzer Actually Is

Roslyn is the .NET compiler platform. Unlike a black-box compiler, it exposes the entire compilation as an API. You can walk the **syntax tree** (the literal structure of the code: attributes, methods, parameters) and query the **semantic model** (what those symbols actually resolve to, such as the real type behind `CreateInvoiceCommand`, including inherited members).

A `DiagnosticAnalyzer` is a plugin that hooks into that pipeline. You subscribe to a kind of syntax node, and the compiler calls you back for each one during every build. If something's off, you report a `Diagnostic`, which surfaces exactly like a built-in compiler warning: in the build output, in the IDE's error list, and as a live squiggle under the offending code as you type.

That last part is what makes it different in kind from a test. A failing test tells a developer they were wrong several minutes ago, after a context switch. An in-line warning tells them while their hand is still on the keyboard and the reasoning is still loaded in their head. The feedback arrives at the moment the decision is being made.

Crucially, this is the same mechanism analyzers from packages like Entity Framework already use. There's no new tool to install and nothing for a developer to opt into.

---

## Encoding the Rule

In our sample scenario, the analyzer's job is to guard the escape hatch. For every method:

1. Is it guarded by `[BusinessAuthorize]`? If not, ignore it.
2. Does it set `CheckAgainstBusinessInRequest = false`? Leaving the property alone means the check is on.
3. Does any parameter's type expose a public `BusinessId` property?
4. If one does, the request names a business the check will never validate. Report a diagnostic.

```csharp
[DiagnosticAnalyzer(LanguageNames.CSharp)]
public class BusinessAuthorizeAnalyzer : DiagnosticAnalyzer
{
    private static readonly DiagnosticDescriptor Rule = new(
        id: "ABC001",
        title: "BusinessAuthorize opts out of validating the BusinessId in the request",
        messageFormat: "Action '{0}' sets CheckAgainstBusinessInRequest = false but " +
                       "request '{1}' carries a BusinessId, so the caller's access " +
                       "to that business is never validated",
        category: "Security",
        defaultSeverity: DiagnosticSeverity.Warning,
        isEnabledByDefault: true,
        description: "CheckAgainstBusinessInRequest = false is only correct when the business scope is enforced " +
                     "somewhere else. If the request carries a BusinessId, the endpoint is vulnerable to cross-tenant access unless the handler filters by the caller's allowed businesses.");

    public override ImmutableArray<DiagnosticDescriptor> SupportedDiagnostics =>
        ImmutableArray.Create(Rule);

    public override void Initialize(AnalysisContext context)
    {
        context.EnableConcurrentExecution();
        context.ConfigureGeneratedCodeAnalysis(GeneratedCodeAnalysisFlags.None);
        context.RegisterSyntaxNodeAction(AnalyzeMethod, SyntaxKind.MethodDeclaration);
    }

    private static void AnalyzeMethod(SyntaxNodeAnalysisContext context)
    {
        var method = (MethodDeclarationSyntax)context.Node;

        // 1. Guarded by [BusinessAuthorize]?
        var attribute = FindBusinessAuthorize(method);
        if (attribute is null) return;

        // 2. Untouched or explicitly true: the check is on, nothing to police.
        if (!OptsOutOfBusinessCheck(attribute)) return;

        // 3. Does any parameter's type expose a public BusinessId?
        var requestType = FindBusinessScopedParameterType(context, method);
        if (requestType is null) return;   // no business in the request: nothing to scope

        // 4. Opted out while the request names a business: warn.
        context.ReportDiagnostic(Diagnostic.Create(
            Rule, attribute.GetLocation(),
            method.Identifier.Text, requestType.Name));
    }
}
```

Notice how much of the design is about *not* firing.

Two decisions do that work. `OptsOutOfBusinessCheck` returns true only for a literal `false` assignment. The request parameter is found by *shape*, not by name: any parameter whose type exposes a public `BusinessId` property is the request, however the type is named.

Step 3 is what keeps the rule off the endpoints that opt out for a mundane reason. An action like `DeleteInvoice(string id)` has no business ID anywhere in its request, so there is nothing to scope against and nothing to warn about, whatever the attribute says.

The result is a rule that fires on exactly one situation: *an endpoint that disabled the business check while its request carries a business ID.*

![The analyzer's decision flow, from controller method to diagnostic](/public/images/enforcing-tenant-isolation-with-a-roslyn-analyzer/analyzer-decision-flow.png "The analyzer's decision flow, from controller method to diagnostic"){: .centered}

---

## Wiring It Into Every Build

This is the part that costs almost nothing and delivers the entire benefit. One reference in the project's `.csproj`, with `OutputItemType="Analyzer"` telling the build to load it as an analyzer rather than link it as a normal dependency:

```xml
<ItemGroup>
  <ProjectReference Include="..\MyApp.Analyzers\MyApp.Analyzers.csproj"
                    OutputItemType="Analyzer"
                    ReferenceOutputAssembly="false" />
</ItemGroup>
```

The analyzer project itself targets `netstandard2.0`, which is required because analyzers load into the compiler host process, whether that host is `dotnet build`, Visual Studio, or Rider.

That's the whole installation. From that commit onward, the check runs on every `dotnet build`, in every IDE, on every developer's machine, for anyone who clones the repository. A rule that lived in someone's head is now part of what the compiler does. A new joiner gets the rule enforced on their first build, before they have any idea the rule exists. Nobody has to be told and nobody has to remember.

---

## Making the Legitimate Opt-Outs Earn Their Place

The endpoints that genuinely need to opt out can suppress the diagnostic, and say why:

```csharp
[SuppressMessage("Security", "ABC001",
    Justification = "Cross-business report; handler filters by the caller's allowed businesses")]
```

With this, the opt-out becomes a written claim, sitting directly above the code, naming the alternative control that makes it safe.

A reviewer no longer has to notice a missing check, which is hard, and instead evaluates a stated argument, which is easy. It also gives you an audit trail for free: searching for `ABC001` lists every deliberate exception in the codebase, each with its reasoning attached.

---

## Warning Today, Error Tomorrow

The severity choice is the part that makes this humane to adopt on an existing codebase.

First, the analyzer can ship at **`Warning`** level only. Every existing violation lights up immediately, everywhere, but the build succeeds. The team works through them deliberately: remove the ones that shouldn't be there, suppress the legitimate ones with a justification.

Once every remaining `ABC001` warning is either fixed or justified, the rule can be changed to an **`Error`**. This needs no change to the analyzer, only one line in `.editorconfig`:

```ini
dotnet_diagnostic.ABC001.severity = error
```

Warning and error are the same rule at different points in the codebase. That single line is what turns it from advice into a property of the build. After it lands, a rule violation is not a code smell, but a build failure, and nobody can skip it.

---

## Conclusion

Every team has a handful of rules the programming language doesn't know: like the type that money has to go through, the factory that entities have to be built with, the base class every handler has to inherit. Writing an analyzer for one of them is a few hours work, and it moves the rule to the compiler so that nobody can forget it.
