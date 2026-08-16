---
layout: post
title: "The Security Check That Relied on Memory"
published: true
description: "A business rule that lived only in developers' memory, pushed down into the compiler with a custom Roslyn analyzer that warns on every rule violation"
categories: [dotnet, security, authorization, aspnetcore]
tags:
  [dotnet, roslyn, analyzers, security, authorization, multitenancy, aspnetcore, csharp, backend]
hero: /public/images/enforcing-tenant-isolation-with-a-roslyn-analyzer/hero.jpg
---

![](/public/images/enforcing-tenant-isolation-with-a-roslyn-analyzer/hero.jpg "Photo by David Magalhães on Unsplash"){: .centered}

*How a Roslyn analyzer moved a business rule from developer memory into every build*

Every codebase accumulates rules the compiler knows nothing about.

For examplr, money always goes through the `Money` type, never a raw decimal. Entities are constructed through their factory, not by hand. Background jobs resolve their own scope.

These rules are load-bearing. Breaking one rarely produces a compiler complaint or a failing test, and the resulting code usually looks perfectly reasonable to a reviewer. So how do you actually enforce a rule your programming language knows nothing about?

Most teams keep them in a wiki page, an onboarding session, or a reminder pinned in the team channel. All of those enforce a rule the same way: by hoping people remember it. That works until the person who remembers is on leave, or is in a hurry, or left last year.

This is how you can stop relying on memory to enforce the rules that matter.

**TL;DR:** A custom authorization attribute scoped every permission check to the tenant in the request, and it did so by default. It also carried an opt-out for the few endpoints that genuinely need it, and that opt-out was one autocomplete away from a cross-tenant hole. A Roslyn analyzer now warns whenever an endpoint disables the check while its request carries a business ID, on every build, on every machine, with no CI pipeline required.

---

## The Setup: Two Layers of Authorization

The platform is a multi-tenant ASP.NET Core application (.NET 8, MediatR for the request pipeline). Every tenant is a "business," and a single user can have roles across several businesses. So authorization has two distinct questions to answer on every request:

1. **Can this user perform this action at all?** (e.g. "Add Invoices")
2. **Can they perform it *for this specific business*?** (the business ID sitting in the request)

Question 1 is action-level. Question 2 is resource-level, and it's the one that actually enforces tenant isolation. Get it wrong and a user who legitimately manages *their* business can reach into *someone else's*.

Both questions are handled by a single custom authorization attribute, and the resource-level check is on by default:

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

The third argument to `CheckAsync` is where tenant isolation lives:

- Pass the business ID, and the check asks: *"Does this user hold `{Action}` on `{Feature}` **for this exact business**?"*
- Pass `null`, and it asks the much weaker question: *"Does this user hold `{Action}` on `{Feature}` for **any** business at all?"*

Note what happens when a request carries no business ID at all. `GetBusinessIdFromRequest` returns null, the check falls back to the general capability question, and the endpoint works normally. A `DeleteInvoice(string id)` action needs no special handling, which matters later.

So the safe thing is the default. Write the attribute the obvious way and your endpoint is scoped to the tenant. The interesting part is the one line that turns it off.

---

## Why the Opt-Out Exists

`CheckAgainstBusinessInRequest = false` disables the resource-level check even when the request *does* carry a business ID. That sounds like a footgun with no purpose, and it would be, except that a handful of endpoints genuinely need it.

The clearest case is a cross-business report. A user with access to several businesses opens a consolidated view, the request names one business as the anchor for the report, and the handler itself filters the results down to the businesses the caller is allowed to see. The scope is enforced, thoroughly, one layer deeper. Applying the attribute's check as well would reject perfectly legitimate requests.

There are a few others in the same shape: endpoints where the business ID in the request identifies something other than the tenant being authorized, and endpoints whose handler does its own, stricter filtering. In each case the opt-out is correct, and removing it from the attribute would break real features.

So the opt-out has to stay. Which means every endpoint carries a decision that only a human can make, and the wrong answer is invisible.

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

In the second version, a user who has the "Add Invoices" capability for *their own* business can send a request with a **different** business's ID in the body. Layer 1 passes, because they do hold "Add Invoices" *somewhere*. Layer 2 has been switched off, so nobody checks whether they hold it for the business they named. The command handler then happily writes an invoice into a tenant the caller was never entitled to.

This is textbook **broken object-level authorization**, a cross-tenant IDOR. It's the kind of bug that is invisible in a demo, invisible in a happy-path unit test, and only shows up when someone goes looking.

The uncomfortable part is how such a line gets written in the first place. Nobody sets out to disable tenant isolation. What happens is that a developer hits a confusing 403 while building a feature, finds an attribute property that sounds related, sets it to `false`, watches the error disappear, and moves on. The change is small, deliberate, and confident. It reviews *well*.

**A secure default is only as good as the discipline around its escape hatch.** So the real question became: where do you put a rule so that nobody can skip it?

---

## Where Do You Put a Rule So It Can't Be Skipped?

There's a ladder here, and each rung is more reliable than the last.

**Memory** is the bottom rung, and it's where this rule started out. Nobody chooses it deliberately. Every convention that isn't enforced somewhere else ends up here by default.

**Documentation** is memory with a URL. It's genuinely useful for explaining *why*, and it is read approximately once, during onboarding, and then never again at the moment it matters.

**Code review** is better, because a second pair of eyes sees the diff. But reviewers are inconsistent by nature. They catch the thing they're primed to look for, and one extra property on an attribute that's already there is not what anyone is scanning for.

**Tests** run without human judgment, which is the leap that matters. A test asserting "no guarded endpoint opts out while carrying a business ID" would work. But a test only helps if something runs it.

**CI** is where most teams stop, and reasonably so. Except this project had no CI pipeline and no test suite wired into one. A rule enforced only in CI is, in practice, a rule enforced only where the pipeline runs. With no pipeline, that test would run only when someone remembered to run it, which is the memory problem again, one level down.

That constraint pushed us to the rung above: the **compiler**. It's the one thing in the workflow that nobody can forget to invoke, because you cannot produce a running application without it. No infrastructure to stand up, no pipeline to maintain, nothing for a developer to opt into. In .NET, that rung has a name: a Roslyn analyzer.

---

## What a Roslyn Analyzer Actually Is

Roslyn is the .NET compiler platform. Unlike a black-box compiler, it exposes the entire compilation as an API. You can walk the **syntax tree** (the literal structure of the code: attributes, methods, parameters) and query the **semantic model** (what those symbols actually resolve to, such as the real type behind `CreateInvoiceCommand`, including inherited members).

A `DiagnosticAnalyzer` is a plugin that hooks into that pipeline. You subscribe to a kind of syntax node, and the compiler calls you back for each one during every build. If something's off, you report a `Diagnostic`, which surfaces exactly like a built-in compiler warning: in the build output, in the IDE's error list, and as a live squiggle under the offending code as you type, before you've even saved the file.

That last part is what makes it different in kind from a test. A failing test tells a developer they were wrong several minutes ago, after a context switch. A squiggle tells them while their hand is still on the keyboard and the reasoning is still loaded in their head. The feedback arrives at the moment the decision is being made, which is the only moment when changing it is cheap.

Crucially, this is the same mechanism analyzers from packages like Entity Framework already use. There's no new tool to install and nothing for a developer to opt into.

---

## Encoding the Rule

The analyzer's job is narrow: police the escape hatch. It encodes exactly the judgement a well-primed reviewer would apply, for every method:

1. Is it guarded by `[BusinessAuthorize]`? If not, ignore it.
2. Does it set `CheckAgainstBusinessInRequest = false`? Leaving the property alone means the check is on, so only an explicit opt-out needs a second look.
3. Does any parameter's type expose a public `BusinessId` property, walking base types and interfaces?
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
        description: "Opting out is only correct when the business scope is enforced " +
                     "somewhere else. Suppress ABC001 with a Justification naming where.");

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

Notice how much of the design is about *not* firing. An analyzer that cries wolf gets suppressed globally within a week, and then you have a rule that's worse than no rule, because everyone believes it's protecting them.

Two decisions do that work. `OptsOutOfBusinessCheck` returns true only for a literal `false` assignment. Anything the analyzer can't evaluate with certainty is treated as no opt-out rather than guessed at, so an unusual call site produces silence instead of noise. And the request parameter is found by *shape*, not by name: any parameter whose type exposes a public `BusinessId` property is the request, however the type is named. Matching on a `Command` or `Query` name suffix would have missed real requests, since some of ours end in `V2`. The property lookup mirrors what the attribute does at runtime, including a case-insensitive match and a walk up base types and interfaces, so the analyzer and the runtime can never disagree about what counts as a business-scoped request.

Step 3 is also what keeps the rule off the endpoints that opt out for a mundane reason. An action like `DeleteInvoice(string id)` has no business ID anywhere in its request, so there is nothing to scope against and nothing to warn about, whatever the attribute says.

The result is a rule that fires on exactly one situation: *an endpoint that disabled the business check while its request carries a business ID.*

![The analyzer's decision flow, from controller method to diagnostic](/public/images/enforcing-tenant-isolation-with-a-roslyn-analyzer/analyzer-decision-flow.png "The analyzer's decision flow, from controller method to diagnostic"){: .centered}

---

## Wiring It Into Every Build

This is the part that costs almost nothing and delivers the entire benefit. One reference in the web project's `.csproj`, with `OutputItemType="Analyzer"` telling the build to load it as an analyzer rather than link it as a normal dependency:

```xml
<ItemGroup>
  <ProjectReference Include="..\MyApp.Analyzers\MyApp.Analyzers.csproj"
                    OutputItemType="Analyzer"
                    ReferenceOutputAssembly="false" />
</ItemGroup>
```

The analyzer project itself targets `netstandard2.0`, which is required because analyzers load into the compiler host process, whether that host is `dotnet build`, Visual Studio, or Rider.

That's the whole installation. From that commit onward, the check runs on every `dotnet build`, in every IDE, on every developer's machine, for everyone who clones the repository. A new joiner gets the rule enforced on their first build, before they have any idea the rule exists. Nobody has to be told, nobody has to remember, and there is no configuration a hurried developer can skip.

---

## Making the Legitimate Opt-Outs Earn Their Place

A rule with no escape hatch gets circumvented. The endpoints that genuinely need to opt out suppress the diagnostic, and the suppression has to say why:

```csharp
[SuppressMessage("Security", "ABC001",
    Justification = "Cross-business report; handler filters by the caller's allowed businesses")]
```

This turns out to be the quiet win of the whole exercise. Before, an opt-out was an unremarkable boolean in an attribute, indistinguishable from a hundred other arguments. Now it's a written claim, sitting directly above the code, naming the alternative control that makes it safe.

That changes what code review can do. A reviewer no longer has to notice a missing check, which is hard, and instead evaluates a stated argument, which is easy. It also gives you an audit trail for free: searching for `ABC001` lists every deliberate exception in the codebase, each with its reasoning attached. If the justification is wrong, at least it's wrong in writing, where someone can challenge it.

---

## Warning Today, Error Tomorrow

The severity choice is the part that makes this humane to adopt on an existing codebase.

The analyzer ships at **`Warning`**. Every existing opt-out lights up immediately, everywhere, but the build stays green. The team works through them deliberately: remove the ones that shouldn't be there, suppress the legitimate ones with a justification. No forced scramble, no branch that has to fix forty endpoints before it can compile.

Once every remaining `ABC001` is either fixed or justified, the rule graduates to an **error**. This needs no change to the analyzer, only one line in `.editorconfig`:

```ini
# An unjustified opt-out of tenant scoping is a build failure.
dotnet_diagnostic.ABC001.severity = error
```

Warning and error are the same rule at different points in the codebase's readiness. That single line is what turns "never disable tenant scoping on an endpoint that names a business" from advice into a property of the build. After it lands, an unjustified opt-out is not a code smell, not a review comment, and not a finding in next year's audit. It's a compile failure, and nobody ships past it.

---

## Lessons

**Secure by default is the start of the job, not the end of it.** The attribute did the right thing unless someone told it otherwise, which is exactly how it should be designed. But every safe default worth having comes with an escape hatch for the cases it can't cover, and the escape hatch is where the next incident lives. Guard it with something stronger than good intentions.

**Push guardrails as close to the developer as you can.** Memory, documentation, code review, tests, CI, compiler: each rung catches more than the one below it, and catches it sooner. A compiler-enforced rule runs earlier, more often, and with zero chance of being skipped. That matters most when there's no CI to fall back on, but it's the right instinct even when there is.

**Analyzers turn institutional knowledge into something executable.** "Don't turn off the tenant check on an endpoint that carries a business ID" is exactly the sort of knowledge that evaporates with turnover. Written into an analyzer, it can't be forgotten, can't go stale, and doesn't depend on the right person reviewing the right pull request.

**An analyzer's precision is its credibility.** Every false positive spends trust you can't easily earn back, and a rule that fires wrongly gets suppressed wholesale. Design the escape conditions as carefully as the detection, and make the analyzer stay quiet whenever it can't be sure.

**Force the exceptions to explain themselves.** A justified suppression is worth more than a silent opt-out, and not only for the reviewer reading it today. It converts scattered, invisible decisions into a searchable list of deliberate ones.

**Warning-then-error is the kind way to retrofit a rule.** Landing a new rule as an error punishes the whole team for debt none of them may have created. Land it as a warning, work through the findings, then promote it. Same end state, no bad first day.

---

## Conclusion

The bug this analyzer prevents was never really in the authorization attribute. The attribute defaults to the safe behavior and does exactly what it's told when someone overrides it. The weak point was the override itself: a single property, easy to reach for while debugging, impossible to spot in review, and catastrophic on the wrong endpoint. Putting the rule in the compiler is what closed that gap. A warning today, an error tomorrow, on every build and every machine, with no pipeline to depend on and nothing for anyone to remember.

None of that is specific to tenant isolation. Every team has a handful of rules the language doesn't know: the type that money has to go through, the factory that entities have to be built with, the base class every handler has to inherit. Each one is currently being enforced somewhere on the ladder, and for most teams that somewhere is memory. Writing an analyzer for one of them is an afternoon's work, and it moves the rule to a rung where forgetting stops being possible.

What rules is your team still enforcing with memory and code review? I'd love to hear which ones you've managed to push down into tooling, and how the team took it.
