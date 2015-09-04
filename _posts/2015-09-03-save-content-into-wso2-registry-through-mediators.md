---
layout: post
title: 'Save content into WSO2 Registry through WSO2 ESB mediators'
published: true
description: How to store and retrieve content to and from WSO2 Registry using WSO2 ESB 4.8.1. This post discusses two possible options using the script mediator and the class mediator
categories: [cs, programming, gotchas, wso2]
tags: [persist registry, save content, synapse, ESB 481, WSO2 Registry, java, WSO2]
---


>  In upcoming `ESB 4.9.0` release we can achieve this directly using the property mediators registry scope.


In WSO2 `ESB 4.8.1` there is no direct way to save content to registry through synapse mediation.
This post describes two possible options we have with `ESB 4.8.1` to save content to registry.
Those are by using either the [Script Mediator](https://docs.wso2.com/display/ESB481/Script+Mediator) or the [Class Mediator](https://docs.wso2.com/display/ESB481/Class+Mediator).

Following examples shows how to store the value of property `myProperty` of type String in message context in to the registry path
`conf:/store/myStore`

##Script Mediator

Achieving this with script mediator is relatively easy. **Note that using the script mediator will have some performance impact on your mediation logic.**

Here is a sample code snippet of a script mediator to save the value stored under `myProperty` in message context to registry.

<script src="https://gist.github.com/Asitha/c185878fdc0460c9d8cd.js"></script>

##Class Mediator

First of all, you need to create a class mediator. You can follow [this](https://docs.wso2.com/display/ESB481/Writing+a+WSO2+ESB+Mediator) guide to write your own class mediator.
After that what you need is to write some Java code similar to following to store the content in to the registry.

<script src="https://gist.github.com/Asitha/481688f06ab156737985.js"></script>

##Retrieve content

To retrieve the stored content you can simply use the `get-property` Xpath function with `registry` scope as follows.

```xml
<property name="regContent"
          expression="get-property('registry', 'conf:/store/myStore')"/>

```

*Cheers!*

> Written by [Asitha Nanayakkara](http://asitha.github.io/about)
