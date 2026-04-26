---
layout: post
title: "Practical Experience: Migrating an Old .NET Project with GitHub Copilot Agent"
published: true
description: "Practical Experience: Migrating an Old .NET Project with GitHub Copilot AgentI recently migrated an existing CQRS (Command Query Responsibility Segregation) imp"
categories: [dotnet, ai, c-sharp-programming, cqrs, github]
tags: [dotnet, ai, c-sharp-programming, cqrs, github]
cross_posts:
  - platform: medium
    url: https://towardsdev.com/practical-experience-migrating-an-old-net-project-with-github-copilot-agent-cb564b6688fe
medium_guid: https://medium.com/p/cb564b6688fe
---

<div class="message">
    <small>
  This article was originally published on <a href="https://towardsdev.com/practical-experience-migrating-an-old-net-project-with-github-copilot-agent-cb564b6688fe">Towards Dev</a>.
    </small>
</div>

### Practical Experience: Migrating an Old .NET Project with GitHub Copilot Agent

![](/public/images/practical-experience-migrating-an-old-net-project-with-github-copilot-/image-1.jpg "Photo by Roman Synkevych on Unsplash")

I recently migrated an existing CQRS (Command Query Responsibility Segregation) implementation from a manual service-based approach to use the MediatR library for better separation of concerns and maintainability, with async/await support for improved performance.

The project is a sample contact book app I built using C# and .NET Core. The project followed the CQRS pattern but was using a more traditional manual service-based approach. More about the project can be found [here](https://medium.com/towardsdev/implementing-cqrs-in-asp-net-af30881279df).

Here’s how I achieved this refactoring with GitHub Copilot’s assistance. GitHub Copilot provides a coding agent feature that can automate tasks like this. You can learn more about it [here](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/create-a-pr)

First, I accessed my existing GitHub repository and created an agent task for GitHub Copilot to work on.

![](/public/images/practical-experience-migrating-an-old-net-project-with-github-copilot-/image-2.png)

While the agent worked on the initial changes, I monitored the progress through the repository’s Actions page.

![](/public/images/practical-experience-migrating-an-old-net-project-with-github-copilot-/image-3.png)

After a while, Copilot opened a pull request with the changes. The agent added the MediatR dependency version 13.0.0 to the project and modified several existing files.

[Migrate CQRS implementation to use MediatR with async/await support by Copilot · Pull Request #3 · pabasara-mahindapala/ContactBook](https://github.com/pabasara-mahindapala/ContactBook/pull/3)

I was curious why Copilot chose this specific version of MediatR, so I asked it directly. Copilot explained in a reply comment that it selected version 13.0.0 because it was the latest stable release at the time.

![](/public/images/practical-experience-migrating-an-old-net-project-with-github-copilot-/image-4.png)

When reviewing the changes to other files, I noticed that Copilot had modified the Commands and Queries to implement MediatR’s **IRequest** and **IRequestHandler** interfaces. This allows for better separation of concerns and makes the code more maintainable.

Business logic from the services had been moved to the respective handlers, ensuring that each handler is responsible for a single operation while still using the existing data access repositories.

Upon further review, I noticed that the handlers could be improved by implementing async/await patterns for better performance. I asked Copilot to make this change, and it promptly added a new commit to the pull request. The underlying data access methods were also updated to their async versions.

![](/public/images/practical-experience-migrating-an-old-net-project-with-github-copilot-/image-5.png)

After a final review of the changes, it was time for testing.

I merged the first pull request and created a new agent task to add unit tests for the project.

As before, I monitored the agent’s progress through the agent sessions page.

![](/public/images/practical-experience-migrating-an-old-net-project-with-github-copilot-/image-6.png)

It looks like under the hood, the agent was using the Playwright MCP server to automate the browser interactions.

[Add test project and unit tests for ContactBook by Copilot · Pull Request #4 · pabasara-mahindapala/ContactBook](https://github.com/pabasara-mahindapala/ContactBook/pull/4)

After a while, Copilot created a new pull request with unit tests for me to review. It chose xUnit as the testing framework, and Moq was used for mocking dependencies like repositories.

To further test the agent’s capabilities, I asked Copilot to use NUnit instead of xUnit for the unit tests. Copilot made the changes and added a new commit to the pull request. Satisfied with the updates, I merged the pull request and ran all the tests to ensure everything was working as expected.

![](/public/images/practical-experience-migrating-an-old-net-project-with-github-copilot-/image-7.png)

Using GitHub Copilot Agent to refactor my old CQRS implementation to use MediatR with async/await support was a great experience. It handled most of the repetitive work, allowing me to focus on reviewing and guiding the changes while ensuring it stayed on the intended path.

It remains to be seen how well it will perform in more complex scenarios and whether such agents can maintain deterministic behavior in all situations.