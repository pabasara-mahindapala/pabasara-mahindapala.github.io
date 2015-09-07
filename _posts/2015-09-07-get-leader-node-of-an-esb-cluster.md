---
layout: post
title: 'How to get the leader node of a WSO2 ESB Cluster'
published: true
description: This post describes how to check whether the current node is the leader node of the ESB cluster. And a example use case of using this property to write a cluster aware scheduled task in WSO2 ESB.
categories: [cs, programming, gotchas, wso2, esb]
tags: [leader node, hazelcast, wso2, esb, script mediator, class mediator, cluster aware, scheduled task]
---

This post describes how to check whether the current node is the leader node of
an ESB cluster. An example use case of using this property to write a
cluster aware scheduled task in WSO2 ESB.

While writing a proxy service or a sequence there might be an instance where you
want only one ESB node to do a particular task. In that case we can use the
leader node in the cluster or try to get hold of a cluster wide lock (using a DB
based solution or Hazelcast). This blog post explain how to achieve this using
Hazelcast leader node.

## Hazelcast Leader node

WSO2 carbon server which WSO2 ESB is built upon uses [Hazelcast](http://hazelcast.org/)
as the cluster coordination implementation. In Hazelcast there is a mechanism
to reliably get the leader node of a cluster. Only one node in a cluster at a given
time becomes the leader node. We can use this property of Hazelcast within WSO2
ESB using either a [script mediator](https://docs.wso2.com/display/ESB481/Script+Mediator) or a [class mediator](https://docs.wso2.com/display/ESB481/Class+Mediator)
to get the leader node.

## Retrieving leader with a Class mediator

Following is a Java code snippet to get the leader node of a Hazelcast cluster.
We can use this within a class mediator to get the leader node of the ESB cluster.

<script src="https://gist.github.com/Asitha/a079a0b450e76292fafc.js"></script>

*You can follow [this](https://docs.wso2.com/display/ESB481/Writing+a+WSO2+ESB+Mediator) guide to write your own class mediator.*

## Retrieving leader with a Script Mediator

We can use the same Java code with some modifications within the script mediator
as well. This option is much easier to implement and deploy in an ESB cluster.

<script src="https://gist.github.com/Asitha/27a1b80c825e95507a3c.js"></script>

## Use case

One of the use cases of this property is to create a cluster aware scheduled
task in WSO2 ESB.

Upto `ESB 4.8.1` scheduled tasks cannot be controlled to be scheduled only in a
single node at a time. Only option is to use pinned servers which has a
single point of failure.

Even though the scheduled tasks deployed in the cluster injects a
message to each proxy or sequence in the cluster, we can make only one proxy
service to mediate the message by evaluating the leader node property as mentioned
above.

Hope this is useful to someone.

*Cheers!*

> Written by [Asitha Nanayakkara](http://asitha.github.io/about)
