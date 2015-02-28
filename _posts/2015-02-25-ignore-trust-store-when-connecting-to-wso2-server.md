---
layout: post
title: 'How to ignore trust store when connecting to a WSO2 server'
published: true
categories: [cs, programming, gotchas, wso2]
tags: [ignore trust store, TrustAllTrustManager, identity server, java, axis2, WSO2, IS, java gotchas, java puzzlers, ]
---

##Problem
There might be an instances where you want to **connect to a WSO2 server** (eg: WSO2 Identity Server) using an **axis2 client stub** with an **SSL connection**. In that case you need to set a trust store for the client application to trust the server. Trusting the server or not is totally up to the client. And the default trust store of Java doesn't have the self signed certificate of a default wso2 server. Hence we usually use system properties to set the correct trust store.

There might be a requirement to totally **ignore the certificate** and trust whatever the server it connects to by ignoring the trust store. Most probably in a testing environment. Way to do this is some what different from a usual java HTTP client when we use **axis2 client stub** implementations.

##Solution
In axis2 there is a class for this specific purpose, to trust all the servers it connects to, [TrustAllTrustManager](http://axis.apache.org/axis2/java/core/api/org/apache/axis2/java/security/TrustAllTrustManager.html). We can use that `TrustManager` to create an `SSLContext` which trust all the servers.

```java
 SSLContext sslCtx = SSLContext.getInstance("http");
 sslCtx.init(null, new TrustManager[] {new TrustAllTrustManager()}, null);
```

Next we **set SSLContext to axis2 stub** implementation as follows.

```java
stub._getServiceClient().getOptions().setProperty(
	HTTPConstants.CUSTOM_PROTOCOL_HANDLER, 
	new Protocol("https", new SSLProtocolSocketFactory(sslCtx), 443)
	);

```

After that we can use this stub to communicate with the server without any failing SSL handshake issue.

##Gotchas
Most common mistake we do when trying to ignore the trust store using axis2 stubs is that we use something similar to following.

```java
// SSLContext sslContext; created to trust all servers

// Then we set the context to HTTPSURLConnection
HttpsURLConnection.setDefaultSSLSocketFactory(sslContext.getSocketFactory());

// Create all-trusting host name verifier
HostnameVerifier validateAllHosts = new HostnameVerifier() {
	
	public boolean verify(String hostname, SSLSession session) {
		return true;
	}
};

// Set the all-trusting host verifier
HttpsURLConnection.setDefaultHostnameVerifier(validateAllHosts);
``` 

Problem is underlying axis2 client **doesn't use the `HTTPSURLConnection`** hence this code has no effect to the underlying axis2 client.  

## Extension points

There might be an instance where we need to add a given set of certificates to be trusted by our client application. We can use System properties to for that. Instead this can be also achieved by adding our own implementation of `TrustManager` as follows.

```java

// Create the custom trust manager
TrustManager[] customTrustManager = new TrustManager[]{ new X509TrustManager() {

	public java.security.cert.X509Certificate[] getAcceptedIssuers() {
		X509Certificate[] trustedCerts;
		// Set trusted certificates. Or you might return an already
		// created array of trusted certificates
		return trustedCerts;
	}

	public void checkClientTrusted(X509Certificate[] certs, String authType) {
	}

	public void checkServerTrusted(X509Certificate[] certs, String authType) {
	}
}};

// Create the SSL context and set the custom trust manager  
sslContext = SSLContext.getInstance("SSL");
sslContext.init(null, customTrustManager, new java.security.SecureRandom());

// Set the SSLContext to the stub as mention above
``` 

That's all for this gotcha!


> Written by [Asitha Nanayakkara](https://asitha.github.io/about).