---
layout: post
title: "To wrap or not to wrap"
published: true
description: "To wrap or not to wrap, that is the Angular questionShould you write a wrapper layer for UI components in your Angular project?IntroductionA complex Angular app"
categories: [abstraction, angular, front-end-development, programming, web-development]
tags: [abstraction, angular, front-end-development, programming, web-development]
cross_posts:
  - platform: plainenglish
    url: https://javascript.plainenglish.io/to-wrap-or-not-to-wrap-883b6e954114
medium_guid: https://medium.com/p/883b6e954114
---

<div class="message">
    <small>
  This article was originally published on <a href="https://javascript.plainenglish.io/to-wrap-or-not-to-wrap-883b6e954114">JavaScript in Plain English</a>.
    </small>
</div>

### To wrap or not to wrap, that is the Angular question

Should you write a wrapper layer for UI components in your Angular project?

![](/public/images/to-wrap-or-not-to-wrap/image-1.jpeg)

#### Introduction

A complex Angular application can not possibly exist without using components from third-party UI libraries. But using these libraries comes with its own set of challenges:

NaN. While these libraries can provide different components with different features, the APIs of these components can be very different from each other.
NaN. A common observation is how the APIs of a component can change between versions of the library, which can be a headache for a large scale Angular project when upgrading the library.
NaN. Some libraries may not provide all the components you need, or the components may not be flexible enough to meet your requirements.

![](/public/images/to-wrap-or-not-to-wrap/image-2.png)

In an Angular project that I worked a while back, we had few requirements to use third-party UI libraries to build components in the application. When analyzing the available libraries, I realized that there was no “one for all” UI library that could satisfy all of the complex requirements of the application.

For example, I really liked the text input and related components provided by Angular Material, but the table component of Angular Material was not nearly good enough for the use cases of the application. On the other hand, the table component of PrimeNG provided most of the complex features that we needed.

![](/public/images/to-wrap-or-not-to-wrap/image-3.png "https://primeng.org")

Because of this, I looked in to the possibility of using both UI libraries in the application.

This is discouraged in some cases, since it can lead to compatibility issues between the libraries, and because it can bloat the application with multiple libraries. Nevertheless, let me walk you through how we managed to achieve this in our application.

![](/public/images/to-wrap-or-not-to-wrap/image-4.jpeg)

#### What did I do

What would our components look like if we used both Angular Material and PrimeNG components in the same application?

Our template would contain components from both libraries here and there. For example, the user’s profile page would have a text input from Angular Material, while the user will be shown a dropdown from PrimeNG to select their country. Next we might have a button from Angular Material to save the profile, and a table from PrimeNG after that.

```

```

This does not look good.

To solve this, I created a common wrapper layer for the UI components that we use. These wrapper components are built on top of the third-party UI components, and they provide a consistent API that we can use throughout the application.

With this approach, the project structure will look like this:

```

```

For example, I created a wrapper component for text fields that use the text input component from Angular Material under the hood. When we need to use a text field in the application, we used the wrapper component instead of directly using the Angular Material text input.

```

```

```

```

This way, I could ensure that the text fields were consistent across the application and allowed to add additional functionality like labels, validation messages and formatting that can be reused across the application without duplicating.

More importantly, I had the flexibility to change the underlying component in the future without affecting the whole application.

Another example is this card component that was built on top of Angular Material’s card component. It can be used to display content in a card format, and it provides a consistent API for the card’s header, content, and actions passed through a template reference.

```

```

```

```

We could use the abc-card component in our application anywhere we needed a card, and it made our code cleaner and more maintainable. If we ever needed to change the underlying component, we could just change the wrapper component without affecting the whole application.

I also created a wrapper for the table component that used PrimeNG’s table component under the hood. Building this component was a bit more complex, as it needed to handle sorting, filtering, and pagination as well. However, the goal was the same, providing a consistent API for the table component that would be used throughout the application.

```

```

```

```

```

```

This abc-table component made our life easier when building different pages in the application that required a table. It provided a robust table component with sorting, filtering, and pagination capabilities, while allowing us to use the same API across the application. Additionally, the modular design provided by PrimeNG allowed me to import only the necessary modules for the table component, keeping the application lightweight and avoiding conflicts.

We could just pass the TableSettings object to the component, and it would handle the rest. The component would take care of sorting, filtering, and pagination, given that the properties were set correctly.

#### When to do this?

This approach is useful when:

- You have a complex Angular application that requires multiple UI components from different libraries.
- You want to reuse the same UI components across different parts of the application.
- You want to be able to make changes to the UI components later without affecting the whole application.
- You need to implement custom business logic for the UI components used across the application.
- You want to have more control over the UI components and their APIs.

However, this approach may not be suitable when the application is small and does not have advanced UI requirements. You don’t need to add unwanted complexity to the application. You can use a single UI library that provides all the components you need and use them directly.

![](/public/images/to-wrap-or-not-to-wrap/image-5.png "r/ProgrammerHumor")

#### Conclusion

In conclusion, creating a wrapper layer for UI components in a complex Angular project can make it easier to manage and maintain the application. It will ensure consistency across the application and allow more flexibility for changes in the future.

This approach can be particularly useful when using components from multiple UI libraries that have different APIs. However, it is important to consider whether this approach is necessary for an application before implementing, as it can add complexity and overhead.

Thanks for reading!

### Thank you for being a part of the community

*Before you go:*

- Be sure to **clap** and **follow** the writer ️👏️**️**
- Follow us: [**X**](https://x.com/inPlainEngHQ) | [**LinkedIn**](https://www.linkedin.com/company/inplainenglish/) | [**YouTube**](https://www.youtube.com/@InPlainEnglish) | [**Newsletter**](https://newsletter.plainenglish.io/) | [**Podcast**](https://open.spotify.com/show/7qxylRWKhvZwMz2WuEoua0) | [**Twitch**](https://twitch.tv/inplainenglish)
- [**Start your own free AI-powered blog on Differ**](https://differ.blog/) 🚀
- [**Join our content creators community on Discord**](https://discord.gg/in-plain-english-709094664682340443) 🧑🏻‍💻
- For more content, visit [**plainenglish.io**](https://plainenglish.io/) + [**stackademic.com**](https://stackademic.com/)

![](/public/images/to-wrap-or-not-to-wrap/image-6.jpg)

---

[To wrap or not to wrap](https://javascript.plainenglish.io/to-wrap-or-not-to-wrap-883b6e954114) was originally published in [JavaScript in Plain English](https://javascript.plainenglish.io) on Medium, where people are continuing the conversation by highlighting and responding to this story.