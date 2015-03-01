---
layout: post
title: 'Know your longs'
published: true
description: Describes a common mistake done when using Java long type in calculations with other numeric data types.
categories: [cs, programming, gotchas]
tags: [java, numeric overflow, long overflow, java gotchas, java puzzles]
---

This is my go at explaining subtle coding issues that I face in everyday programming and how to properly overcome them. Idea is to make you aware of the pitfalls in coding so that you'll be able to understand and do a better job when you come across similar puzzling moments. 

##Problem
I'll start my series of gotchas with a **Java `long` type** related gotcha. Here is the Java code segment. 

```java
long referenceStart = 41 * 365 * 24 * 60 * 60 * 1000; //this is 2011
System.out.println("value: " + val);
```

*What would be the output of this code segment?* Yes this is a huge value. If we [calculate](http://bit.ly/14OdAga), we get the following answer.

> **Expected output:** value: 1292976000000

Unfortunately what we get as the output is the following

> **Actual output:** value 190843904

##Puzzled ???
First thing that comes to our mind is *numeric overflow*. Is this value 1,292,976,000,000 too big for a `long` to handle? If we look at the maximum value of a `long`, it is 9,223,372,036,854,775,807 that is [2<sup>63</sup> -1](http://docs.oracle.com/javase/tutorial/java/nutsandbolts/datatypes.html).

The expected value is less than the maximum value a `long` can hold. Therefore this can't be a *numeric overflow*. Then why is this giving an incorrect answer? 

##Gotcha!
If we look at the calculation of `referenceStart` closely, we can see that JVM needs to do five multiplications before it assigns the final value to `referenceStart`, which is a `long`. But since the multipliers and multiplicands are integers JVM will do an **integer multiplication**, even though we assign it to a `long`. Maximum value of `int` type is 2,147,483,647 that is [2<sup>31</sup>-1](http://docs.oracle.com/javase/tutorial/java/nutsandbolts/datatypes.html), which is lot less than our expected answer. This causes a *numeric overflow*. the value is converted to a long only when it assigns the value to `referenceStart`. That's why we get this incorrect answer.

##Solution

Solution is to make JVM do a `long` multiplication instead of integer multiplication. How do we do that? Easy, we add an `L` after each value.

```java
// Make the calculation long to avoid numeric overflow
long referenceStart = 41L * 365L * 24L * 60L * 60L * 1000L;
System.out.println("value: " + val);
``` 

##Takeaways 

I came across this while I was meddling with some old code. It was lying around for some time going through some release cycles as well. Luckily this didn't lead to any unpleasant scenarios. All along the IDE was complaining about a *numeric overflow*. Finally this led us to take another look at the code.

Takeaways from this is always be **vigilant about the type of multiplication the JVM might do** and **be aware of IDE/compiler warnings**. 

> Written by [Asitha Nanayakkara](https://asitha.github.io/about).
