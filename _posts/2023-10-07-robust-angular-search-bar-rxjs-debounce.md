---
layout: post
title: A Robust Angular Search Bar with RxJs Debounce
published: true
description: A Robust Angular Search Bar with RxJs Debounce
categories: [software-development, angular]
tags: [angular, javascript, software, programming, coding, rxjs, debounce]
---

<div class="message">
    <small>
  This article was originally published on <a href="https://javascript.plainenglish.io/a-robust-angular-search-bar-with-rxjs-debounce-29a082d6816e">JavaScript in Plain English</a>.
    </small>
</div>

We come across numerous types of search bars and search dropdowns as we browse the internet every day. Most of these search bars would be calling to a backend API to query the results based on our input.

Think about a search bar for countries that displays results as you type.

Assume a user wants to search for Columbia, and the user types in “col” from the keyboard. If the search function is triggered on each keyboard input, there will be three separate search requests for “c”, “co” and “col” (See below).
<br/><br/>

![Unwanted API request are being sent](/public/images/country-search-box.gif "Unwanted API request are being sent"){:.centered}

<br/>

But, only the results from the last request that search for “col” are actually required. Search requests for “c” and “co” are sent to the backend, but their results are not used.

To prevent a search bar from sending unwanted requests like this for each letter the user types in, we can use the **debounce** operator in RxJs.

_By definition, The debounce operator emits a notification from the source Observable only after a particular time span determined by another Observable has passed without another source emission._

In simple words, it prevents sending a request to the API until a configured time (Let’s say 500ms) is passed after an input, without another input. Since the time period between letters when the user typing “c”, “o” and “l” is less than this value, API requests will not be sent. But, when 500ms is passed after the user has typed “col”, the API request for the search will be sent.

I have created a sample search bar in Angular with debounce. Here, I have configured the debounce time as 500ms.

```typescript
ngAfterViewInit() {
    fromEvent(this.searchInput.nativeElement, 'input')
      .pipe(
        pluck('target', 'value'),
        filter((searchTerm: string) => {
          return (
            searchTerm.trim().length >= (this.minLength ? this.minLength : 1)
          );
        }),
        debounceTime(500),
        tap((_) => {
          this.showList = true;
        }),
        switchMap((value) => {
          return this.searchRequest(value);
        })
      )
      .subscribe((result: any) => {
        this.resultList = result;
      });
}
```

After the debounce time is reached, the _searchRequest()_ method is called with the search term. Then it will query the API and return the results as an observable.

You can see a StackBlitz demo of the search bar below. Check the console to see the requests being made.

<iframe src="https://stackblitz.com/edit/angular-search-bar-debounce?ctl=1&embed=1&file=src%2Fapp%2Fapp.component.html&view=preview" title="demo" width="100%" height="700px" frameborder="0"></iframe>

> Don’t forget to check the full source code on <a href="https://github.com/pabasara-mahindapala/search-bar">GitHub</a>!


