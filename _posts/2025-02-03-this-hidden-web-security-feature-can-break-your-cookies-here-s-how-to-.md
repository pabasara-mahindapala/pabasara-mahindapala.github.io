---
layout: post
title: "This Hidden Web Security Feature Can Break Your Cookies — Here’s How to Fix It"
published: true
description: "This Hidden Web Security Feature Can Break Your Cookies — Here’s How to Fix ItWhile working on a project with WSO2 Identity Server (IS) 7.0.0, I encountered a rather interesting issue."
categories: [web, typescript, cookies, frontend, javascript]
tags: [web, typescript, cookies, frontend, javascript]
cross_posts:
  - platform: plainenglish
    url: https://javascript.plainenglish.io/this-hidden-web-security-feature-can-break-your-cookies-heres-how-to-fix-it-7e7813ec3d1d
medium_guid: https://medium.com/p/7e7813ec3d1d
---

<div class="message">
    <small>
  This article was originally published on <a href="https://javascript.plainenglish.io/this-hidden-web-security-feature-can-break-your-cookies-heres-how-to-fix-it-7e7813ec3d1d">JavaScript in Plain English</a>.
    </small>
</div>

### This Hidden Web Security Feature Can Break Your Cookies — Here’s How to Fix It

![](/public/images/this-hidden-web-security-feature-can-break-your-cookies-here-s-how-to-/image-1.jpg "Photo by Maria Baranova on Unsplash")

While working on a project with [WSO2 Identity Server](https://wso2.com/identity-server/) (IS) 7.0.0, I encountered a rather interesting issue. After making all the necessary product configurations and starting the IS server, I noticed that somehow the language switcher on the login pages was not working.

WSO2 IS authentication pages use a cookie named **ui_lang** to store the user’s preferred language. However, in my case, I noticed that the cookie was not being set, and thus the language switcher was failing to work.

Now, this was a bit puzzling. It’s not like I have done any complex configurations or customizations in the product UIs. Everything was pretty much out-of-the-box. However, I could identify that the issue happened due to the hostname I was using for the IS server - **test.gov.rs**.

```

```

This led me to dig deeper into the issue and discover the Public Suffix List (PSL) and its critical role in web application development.

This domain (gov.rs) was included in the Public Suffix List, which caused the browser to restrict setting cookies for this domain. WSO2 IS UIs were incorrectly trying to set the **ui_lang** cookie for this domain. However, any cookies should be set for the subdomain (test.gov.rs) instead when the domain is included in the PSL.

#### Public Suffix List

The [publicsuffix.org](https://publicsuffix.org/) explains the Public Suffix List as follows:

> In the past, browsers used an algorithm which only denied setting wide-ranging cookies for top-level domains with no dots (e.g. com or org). However, this did not work for top-level domains where only third-level registrations are allowed (e.g. co.uk). In these cases, websites could set a cookie for .co.uk which would be passed onto every website registered under co.uk.

> Since there was and remains no algorithmic method of finding the highest level at which a domain may be registered for a particular top-level domain (the policies differ with each registry), the only method is to create a list. This is the aim of the Public Suffix List.

As explained, the Public Suffix List is a curated list of domain suffixes for the purpose of determining the highest level at which a domain may be registered. These suffixes are used to determine the boundaries of cookies and other web security features.

When a domain is included in the PSL, browsers restrict setting cookies for that domain to prevent security issues like cross-site scripting (XSS) attacks. This restriction ensures that cookies are only set for specific subdomains and not for the entire domain.

#### How to fix it?

```

```

[identity-apps/identity-apps-core/apps/authentication-portal/src/main/webapp/includes/language-switcher.jsp at d2b06cbf70f3ccf5857d17711f247715ba542783 · wso2/identity-apps](https://github.com/wso2/identity-apps/blob/d2b06cbf70f3ccf5857d17711f247715ba542783/identity-apps-core/apps/authentication-portal/src/main/webapp/includes/language-switcher.jsp#L66)

In the WSO2 IS UIs, the domain for setting the **ui_lang** cookie was being extracted using the **extractDomainFromHost()** method shown above.

If the hostname was a dot separated domain, the last two tokens were considered as the domain. However, this logic was causing the above issue when the domain was included in the PSL.

To fix this issue, we need to avoid setting cookies for domains included in the PSL. How do we do this?

Sure, we can get a copy of the PSL from [https://publicsuffix.org/list/public_suffix_list.dat](https://publicsuffix.org/list/public_suffix_list.dat) and validate the domains against it.

But the PSL is getting updated regularly with new domain suffixes that are identified as public suffixes, and invalid domains may be removed. Actually, you can submit amendments to the PSL [yourself](https://github.com/publicsuffix/list/wiki/Guidelines) if required.

Therefore, we need a solution that makes sure we are always up-to-date with the latest PSL. One way to do this is to use a library that provides the PSL data and methods to validate domains against it. There are few similar libraries available on npm, like [**tldjs**](https://www.npmjs.com/package/tldts) or [**psl**](https://www.npmjs.com/package/psl).

Otherwise, we need to regularly update the PSL in our application from the official source.

In WSO2 IS, this issue was fixed using the **tldts** library.

```

```

[identity-apps/modules/core/src/utils/url-utils.ts at 566c585d5f99c0b75fb4c5626b206a43dd03c6ab · wso2/identity-apps](https://github.com/wso2/identity-apps/blob/566c585d5f99c0b75fb4c5626b206a43dd03c6ab/modules/core/src/utils/url-utils.ts#L213)

As shown above, the **extractDomainFromHost()** method was replaced with the **getDomain()** method that uses the **tldts** library to safely parse the domain from the hostname. This method ensures that the domain is extracted correctly even when the hostname is a complex domain included in the PSL.

You can refer to this PR for more details:

[Integrate `tldts` to derive the `domain` name by brionmario · Pull Request #7353 · wso2/identity-apps](https://github.com/wso2/identity-apps/pull/7353)

If you are working on any frontend applications that need to handle cookies, make sure to consider the Public Suffix List and use appropriate libraries or methods to handle domain validations and cookie settings.

Have you encountered similar issues with cookies and domain restrictions? Share your experiences in the comments!

#### Read more:

NaN. [https://publicsuffix.org/learn/](https://publicsuffix.org/learn/)
NaN. [https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies)

### Thank you for being a part of the community

*Before you go:*

- Be sure to **clap** and **follow** the writer ️👏**️️**
- Follow us: [**X**](https://x.com/inPlainEngHQ) | [**LinkedIn**](https://www.linkedin.com/company/inplainenglish/) | [**YouTube**](https://www.youtube.com/channel/UCtipWUghju290NWcn8jhyAw) | [**Newsletter**](https://newsletter.plainenglish.io/) | [**Podcast**](https://open.spotify.com/show/7qxylRWKhvZwMz2WuEoua0)
- [**Check out CoFeed, the smart way to stay up-to-date with the latest in tech**](https://cofeed.app/) **🧪**
- [**Start your own free AI-powered blog on Differ**](https://differ.blog/) 🚀
- [**Join our content creators community on Discord**](https://discord.gg/in-plain-english-709094664682340443) 🧑🏻‍💻
- For more content, visit [**plainenglish.io**](https://plainenglish.io/) + [**stackademic.com**](https://stackademic.com/)

---

[This Hidden Web Security Feature Can Break Your Cookies — Here’s How to Fix It](https://javascript.plainenglish.io/this-hidden-web-security-feature-can-break-your-cookies-heres-how-to-fix-it-7e7813ec3d1d) was originally published in [JavaScript in Plain English](https://javascript.plainenglish.io) on Medium, where people are continuing the conversation by highlighting and responding to this story.