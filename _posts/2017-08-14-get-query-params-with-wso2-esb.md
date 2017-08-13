---
layout: post
title: How to retrieve query parameters in WSO2 ESB
published: true
description: This post describes methods to read query parameters of an HTTP request using a synapse configuration in WSO2 ESB.
categories: [cs, programming, wso2, esb, mediators]
tags: [query params, api, wso2, esb]
---

There are several ways to retrieve query parameters from an HTTP request using WSO2 ESB.

 - Using Synapse XPath $url variable
 - Using get-property('query.param.xxx')

We can use the following curl GET request for the following sample API

> $ **curl** *"http://localhost:8280/store/view?name=john&age=29"* **-v**

## Using Synapse $url XPath variable

There is an XPath variable $url which we can use to retrieve query parameters from an HTTP request.


> <property name="name" *expression="$url:name"* type="STRING"/>


Following is an example using the $url. Note that you don't have to mention the query params in the uri-template

<script src="https://gist.github.com/Asitha/05b6eaa179ed0be3eb7a51f11548ca8e.js"></script>

## Using get-property('query.param.xxx')

Another option is to use the get-property function with argument as query.param.<value> where **value** is the relevant name of the query parameter

> *get-property('query.param.name')*

#### Example API with get-property function
<script src="https://gist.github.com/Asitha/0938415a567e3c54ca72f2337e4048f8.js"></script>

### Sample curl rquest and response

> $ **curl** *"http://localhost:8280/store/view?name=john&age=29"* **-v**

```
*   Trying 127.0.0.1...
* Connected to localhost (127.0.0.1) port 8280 (#0)
> GET /store/view?name=john&age=29 HTTP/1.1
> Host: localhost:8280
> User-Agent: curl/7.50.1
> Accept: */*
> 
< HTTP/1.1 200 OK
< Accept: */*
< Host: localhost:8280
< Content-Type: application/x-www-form-urlencoded; charset=UTF-8
< Date: Sun, 13 Aug 2017 14:40:01 GMT
< Transfer-Encoding: chunked
< 
* Connection #0 to host localhost left intact
<user><name>john</name><age>29</age></user>

```


You can test this out with [WSO2 Integrator](http://wso2.com/integration) which is the WSO2 ESB product packaged with other integration products like WSO2 Message Broker, WSO2 Business Process Engine and WSO2 Data Services Server.

*Cheers!*

> Written by [Asitha Nanayakkara](http://asitha.github.io/about)
