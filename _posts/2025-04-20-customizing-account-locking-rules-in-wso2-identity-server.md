---
layout: post
title: "Customizing Account Locking Rules in WSO2 Identity Server"
published: true
description: "In a project I worked on recently, there was a business requirement to implement custom account locking rules for different authentication methods in WSO2 Identity Server (WSO2 IS) 7.0.0."
categories: [authentication, authorization, java, wso2, wso2is]
tags: [authentication, authorization, java, wso2, wso2is]
cross_posts:
  - platform: towardsdev
    url: https://towardsdev.com/customizing-account-locking-rules-in-wso2-identity-server-158bf67ca38d
medium_guid: https://medium.com/p/158bf67ca38d
---

<div class="message">
    <small>
  This article was originally published on <a href="https://towardsdev.com/customizing-account-locking-rules-in-wso2-identity-server-158bf67ca38d">Towards Dev</a>.
    </small>
</div>

![](/public/images/customizing-account-locking-rules-in-wso2-identity-server/image-1.jpg "Photo by Jakub Żerdzicki on Unsplash")

In a project I worked on recently, there was a business requirement to implement custom account locking rules for different authentication methods in WSO2 Identity Server (WSO2 IS) 7.0.0. The requirement was to lock the user account permanently after three consecutive failed username/password attempts and temporarily after three consecutive failed OTP attempts.

WSO2 IS handles account locking through the default AccountLockHandler implementation. However, the current behavior does not allow for differentiating between authentication methods and setting different locking rules.

To achieve this requirement, I had to extend the default AccountLockHandler and implement a custom account lock handler.

Following is a detailed explanation of the implementation.

### Business Requirements

- **Permanent Locking:** Lock the account permanently after 3 failed username/password attempts.
- **Temporary Locking:** Lock the account temporarily (5 minutes) after 3 failed OTP attempts.

### Steps to Implement

The default AccountLockHandler in WSO2 IS is implemented as an event handler. An event handler in WSO2 IS can listen for specific events and execute different actions based on those events.

The default AccountLockHandler listens for authentication events and handles account locking, account unlocking and account lock validation for users.

[identity-event-handler-account-lock/components/org.wso2.carbon.identity.handler.event.account.lock/src/main/java/org/wso2/carbon/identity/handler/event/account/lock/AccountLockHandler.java at d9a0567aca30bd0f1d2ec2ce638273bf6af3730e · wso2-extensions/identity-event-handler-account-lock](https://github.com/wso2-extensions/identity-event-handler-account-lock/blob/d9a0567aca30bd0f1d2ec2ce638273bf6af3730e/components/org.wso2.carbon.identity.handler.event.account.lock/src/main/java/org/wso2/carbon/identity/handler/event/account/lock/AccountLockHandler.java)

To achieve the requirement, we need to extend the default AccountLockHandler and implement custom logic to differentiate between authentication methods. The following steps outline the process:

#### 1. Extend the Default AccountLockHandler

We need to extend the default handler and override the required methods to implement custom logic. Refer to [the documentation](https://is.docs.wso2.com/en/7.0.0/references/extend/user-mgt/write-a-custom-event-handler/) for detailed instructions on writing a custom event handler.

#### 2. Implement the Custom Event Handler

First, we need to override the getName() method to set a unique name for the custom handler.

To track the number of failed attempts, WSO2 IS uses different claims for username/password and non-basic authenticators. In this case, we will consider the username/password and SMS OTP authenticators.

The claim http://wso2.org/claims/identity/failedLoginAttempts is used for the username/password authenticator and http://wso2.org/claims/identity/failedSmsOtpAttempts is used for the SMS OTP authenticator. We can get this claim from the [failedAttemptsClaim](https://github.com/wso2-extensions/identity-event-handler-account-lock/blob/d9a0567aca30bd0f1d2ec2ce638273bf6af3730e/components/org.wso2.carbon.identity.handler.event.account.lock/src/main/java/org/wso2/carbon/identity/handler/event/account/lock/AccountLockHandler.java#L314) variable and use it to differentiate between the username/password and SMS OTP authenticators.

When the maximum number of failed attempts is reached for an authentication step, it is handled by this [code block](https://github.com/wso2-extensions/identity-event-handler-account-lock/blob/d9a0567aca30bd0f1d2ec2ce638273bf6af3730e/components/org.wso2.carbon.identity.handler.event.account.lock/src/main/java/org/wso2/carbon/identity/handler/event/account/lock/AccountLockHandler.java#L466) in the default account lock handler in WSO2 IS. We are only required to modify this section to control the account lock behavior.

This [section](https://github.com/wso2-extensions/identity-event-handler-account-lock/blob/d9a0567aca30bd0f1d2ec2ce638273bf6af3730e/components/org.wso2.carbon.identity.handler.event.account.lock/src/main/java/org/wso2/carbon/identity/handler/event/account/lock/AccountLockHandler.java#L473-L493) is responsible for setting the account lock time for the user. We can modify this section to set different lock times for the username/password and SMS OTP authenticators based on the failedAttemptsClaim value.

If the value of the http://wso2.org/claims/identity/unlockTime claim is set to 0, the account will be locked permanently. Otherwise we can set a future timestamp to lock the account temporarily.

```

```

#### 3. Deploy and Configure the Custom Account Lock Handler

- Build the custom account lock handler with `mvn clean install` and deploy the generated JAR file in the /repository/components/dropins directory.
- Add the following configuration in the /repository/conf/deployment.toml file to disable the default AccountLockHandler since we are adding a custom implementation:

```

```

- Add the custom account lock handler configuration in the deployment.toml file:

```

```

- Restart the WSO2 IS server to apply the changes.

The complete source code for the custom account lock handler is available in the following GitHub repository:

[GitHub - pabasara-mahindapala/custom-account-lock-handler: This is a custom account lock handler for WSO2 IS implemented to lock user accounts temporarily or permanently based on whether basic authentication or non-basic authentication is used (SMS OTP, Email OTP, TOTP)](https://github.com/pabasara-mahindapala/custom-account-lock-handler)

### Try it out

To test the custom account lock handler, you can configure username/password and SMS OTP as authentication steps in your application.

Then, try logging in with incorrect credentials for the username/password step three times and you should see the account being permanently locked. Similarly, try logging in with incorrect OTP three times and you should see the account being temporarily locked for a configurable duration.

![](/public/images/customizing-account-locking-rules-in-wso2-identity-server/image-2.jpg)

---

[Customizing Account Locking Rules in WSO2 Identity Server](https://towardsdev.com/customizing-account-locking-rules-in-wso2-identity-server-158bf67ca38d) was originally published in [Towards Dev](https://towardsdev.com) on Medium, where people are continuing the conversation by highlighting and responding to this story.