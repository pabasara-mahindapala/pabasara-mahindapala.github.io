---
layout: post
title: "The Residuality Method: Evolving an Identity System from Naive to Unbreakable"
published: true
description: "When we design software, usually we focus on the functional requirements and try to follow the happy path."
categories: [software-architecture, coding, programming, system-design-concepts, software-development]
tags: [software-architecture, coding, programming, system-design-concepts, software-development]
cross_posts:
  - platform: medium
    url: https://medium.com/@pabasaramahindapala/the-residuality-method-evolving-an-identity-system-from-naive-to-unbreakable-533127590838
medium_guid: https://medium.com/p/533127590838
---

<div class="message">
    <small>
  This article was originally published on <a href="https://medium.com/@pabasaramahindapala/the-residuality-method-evolving-an-identity-system-from-naive-to-unbreakable-533127590838">Medium</a>.
    </small>
</div>

![](/public/images/the-residuality-method-evolving-an-identity-system-from-naive-to-unbre/image-1.jpg "Photo by Leo_Visions on Unsplash (Cathédrale Notre-Dame de Paris - Built to last a thousand years)")

When we design a piece of software, usually we focus on the functional requirements and often try to follow the happy path.

We create detailed diagrams that explain how data flows through the system, how different components work together, and how all requirements are met.

Yet, when these systems are tested against the real world, they often crumble. Long outages, unsatisfied users and business losses comes next, and the architecture that looked perfect on paper fails to survive.

![](/public/images/the-residuality-method-evolving-an-identity-system-from-naive-to-unbre/image-2.jpg "Photo by GuerrillaBuzz on Unsplash")

Recently, I came across the **Residuality Theory**, an approach to software architecture that focuses on building systems that can survive chaos.

The residuality theory, created by **Barry O’Reilly**, is a way to design software architecture not based on predicted requirements, but on the “residue” that remains after the software is tested against random, chaotic events.

Instead of guessing what features we need, we apply different stressors to find the failure points and reinforce the structure to survive them. The result is an architecture that is capable of surviving unexpected challenges.

Today I will focus on a specific example, building an Identity & Access Management (IAM) software that can survive in the real world, following the Residuality Method.

#### Start Naive

First, we start with a naive architecture. This is the simplest possible design that meets all the functional requirements.

As the second step, we apply a random, chaotic event (a stressor) to the system. This could be a business event, a technical failure or a malicious attack from the outside.

Then we observe the failure points and reinforce just enough structure to survive that failure. The result is the residue, which becomes part of our final architecture.

Finally, we reiterate this process with different stressors, building a robust system that can survive a wide range of unexpected events.

### Building an IAM System

Let’s apply this method to build an Identity and Access Management (IAM) system. We will start with a naive architecture and evolve it through multiple stressors that I have encountered in real-world IAM projects.

![](/public/images/the-residuality-method-evolving-an-identity-system-from-naive-to-unbre/image-3.jpg "Photo by Brett Jordan on Unsplash")

#### Naive IAM Architecture

Our starting point is an monolithic IAM system. It consists of a API service connected to a User Database. It follows the standard Open ID Connect (OIDC) flow.

Applications use the API service to authenticate users with username and password, and exchange an authorization code for an access token and refresh token. The system keeps a few claims for the users stored in the database, and return the user’s permissions back to the application in the JWT token.

Simple, straightforward, and meets the functional requirements.

#### Stressor 1: The IOPS Saturation (Database Volume)

The first stressor we apply is the “IOPS Saturation.” Imagine that our user base grows to 10 million active users, and every active user triggers a database write every 15 minutes to rotate their refresh token.

At a peak time, our SQL database crashes under the write pressure from ephemeral tokens.

![](/public/images/the-residuality-method-evolving-an-identity-system-from-naive-to-unbre/image-4.jpg "Photo by William Warby on Unsplash")

The reinforcement we introduce to survive this stressor is Polyglot Persistence. We acknowledge that “Identity Data” (users, not frequently changing) and “Session Data” (tokens, high churn) have different physics.

We separate the storage architecture, moving high-churn data (tokens) to a Key-Value Store (like Redis or DynamoDB), while keeping the SQL database for stable user profile data.

#### Stressor 2: The Header Overflow (Data Bloat)

The next stressor is the “Header Overflow.” A client creates complex roles utilizing the Role-Based Access Control (RBAC) features we provide, and a single user now has 500+ granular permissions.

The JWT size swells to 15KB, which exceeds the HTTP header limit of most load balancers and CDNs, causing valid requests to be rejected.

![](/public/images/the-residuality-method-evolving-an-identity-system-from-naive-to-unbre/image-5.jpg "Photo by Miguel Ángel Padriñán Alba on Unsplash")

To survive this stressor, we implement the Claim-Check Pattern. We stop sending the permission data in the token and instead send a key to the data.

The JWT now contains only a small `artifact_id`, and the permissions are stored in a distributed cache. The API Gateway intercepts the request, retrieves the massive permission set from the cache, and “hydrates” the request context internally.

#### Stressor 3: The Data Gravity Well (Large Media)

The final stressor is the “Data Gravity Well.” We allow our users to upload a picture for their profile.

Some users upload high-resolution profile photos, which are Base64 encoded and saved into a TEXT or BLOB column in the Users table. The database memory fills up with image data, killing performance. To survive this, we introduce Object Storage Indirection.

![](/public/images/the-residuality-method-evolving-an-identity-system-from-naive-to-unbre/image-6.jpg "Photo by Zheng XUE on Unsplash")

We move binaries to an Object Store (like AWS S3 or Azure Blob Storage) and store only the URL in the database. This segregates structured data (fast, expensive storage) from unstructured data (slow, cheap storage), ensuring the database can survive high-res content demands.

#### Final Architecture

By applying these stressors picked from real-world experiences, our final architecture has evolved significantly.

We now have **Redis **for caching high-churn data, a** claim-check pattern** for handling large permission sets, and external **object storage **for large media. This architecture is not what we initially designed, but it is what remained after surviving the stressors.

![](/public/images/the-residuality-method-evolving-an-identity-system-from-naive-to-unbre/image-7.jpg "Photo by erika m on Unsplash")

The Residuality Method moves us from guessing future requirements to stress-testing our architecture against chaos that actually happens in the real world.

By embracing chaos and failures as sources of insight, we can build systems that are resilient, adaptable, and capable of surviving unexpected challenges.