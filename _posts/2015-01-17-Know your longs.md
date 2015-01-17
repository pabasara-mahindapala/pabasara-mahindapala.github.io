---
layout: post
title: Know your longs
published: false
---

Gotchas #1 : Know your longs
========================

This is my go at explaining subtle coding issues that I face in everyday programming and how to properly overcome them. Idea is to make you aware of the pitfalls in coding so that you'll be able to understand and do a better job when you come across similar puzzling moments. 

This is a **Java long type** related gotcha. Here is a java code segment. 

```java
long dayInMillis = 10*24*1000*10024;
System.out.println("Day: " + dayInMillis);
```

*What would be the output of this code segment?* 


