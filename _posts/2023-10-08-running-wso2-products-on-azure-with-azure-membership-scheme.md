---
layout: post
title: Running WSO2 Products on Azure with Azure Membership Scheme
published: true
description: Running WSO2 Products on Azure with Azure Membership Scheme
categories: [software-development, wso2]
tags: [wso2, azure, software, programming, coding, cloud, hazelcast, wso2is]
---

<div class="message">
    <small>
  This article was originally published on <a href="https://towardsdev.com/running-wso2-products-on-azure-with-azure-membership-scheme-3175113d8e10">Towards Dev</a>.
    </small>
</div>

![Azure Membership Scheme](/public/images/azure-membership-scheme.png "Azure Membership Scheme"){:.centered}

Have you ever deployed WSO2 products in Azure virtual machines?

Today I’m going to tell you how you can easily run a cluster of WSO2 Identity Server on Azure virtual machines. To automatically discover the Identity Server nodes on Azure, we can use the [Azure Membership Scheme](https://github.com/pabasara-mahindapala/azure-membership-scheme).

_Please note that this article is written based on using WSO2 Identity Server 5.11 with the Azure Membership Scheme. You can use the Azure Membership Scheme with other WSO2 products as well._

You can get a basic understanding about clustering in WSO2 Identity Server by reading this [doc](https://is.docs.wso2.com/en/5.11.0/setup/deployment-guide/).

## How Azure Membership Scheme works

You can find the Azure Membership Scheme in this [repository](https://github.com/pabasara-mahindapala/azure-membership-scheme).

When a Carbon server is configured to use the Azure Membership Scheme, it will query the IP addresses in the given cluster using the Azure services during startup.

To discover the IP addresses, name of the Azure resource group where the virtual machines are assigned should be provided. After discovering, the Hazelcast network configuration will be updated with the acquired IP addresses. As a result, the Hazelcast instance will get connected to all the other members in the cluster.

In addition, when a new member is added to the cluster, all other members will get connected to the new member.

The following two approaches can be used for discovering Azure IP addresses.

### Using the Azure REST API

Azure REST API is used to get the IP addresses of the virtual machines from the resource group and provide them to the Hazelcast network configuration.

### Using the Azure SDK

Azure Java SDK is used to query the IP addresses of the virtual machines from the resource group and provide them to the Hazelcast network configuration.

By default, the Azure REST API will be used to discover the Azure virtual machines in the Azure Membership Scheme (If you want to use the Azure Java SDK to discover the Azure virtual machines, please refer to [https://github.com/pabasara-mahindapala/azure-membership-scheme/blob/master/README.md](https://github.com/pabasara-mahindapala/azure-membership-scheme/blob/master/README.md)).

## How to use the Azure Membership Scheme

Follow the given steps to use the Azure Membership Scheme.

- Clone the Azure Membership Scheme repository and run the following command from the `azure-membership-scheme` directory

```bash
mvn clean install
```

- Copy the following JAR file from `azure-membership-scheme/target` to the `<carbon_home>/repository/components/lib` directory of the Carbon server.

```
azure-membership-scheme-1.0.0.jar
```

- Copy the following dependencies from `azure-membership-scheme/target/dependencies` to the `<carbon_home>/repository/components/lib` directory of the Carbon server.

```
azure-core-1.23.1.jar
content-type-2.1.jar
msal4j-1.11.0.jar
oauth2-oidc-sdk-9.7.jar
```

- Configure the membership scheme as shown in the `<carbon_home>/repository/conf/deployment.toml` file.

```toml
[clustering]
membership_scheme = "azure"
local_member_host = "127.0.0.1"
local_member_port = "4000"
[clustering.properties]
membershipSchemeClassName = "org.wso2.carbon.membership.scheme.azure.AzureMembershipScheme"
AZURE_CLIENT_ID = "{{client-id}}"
AZURE_CLIENT_SECRET = "{{client-secret}}"
AZURE_TENANT = "{{tenant}}"
AZURE_SUBSCRIPTION_ID = "{{subscription-id}}"
AZURE_RESOURCE_GROUP = "{{resource-group}}"
AZURE_API_ENDPOINT = "https://management.azure.com"
AZURE_API_VERSION = "2021-03-01"
```

- When the server is starting, you will be able to see the logs related to the cluster initialization.

I have explained the parameters required to configure the Azure Membership Scheme below.

- AZURE_CLIENT_ID - Azure Client ID should be obtained by registering a client application in the Azure Active Directory tenant. The client app needs to have the necessary permissions assigned to perform the action `Microsoft.Network/networkInterfaces/read` [1].

eg: `53ba6f2b-6d52-4f5c-8ae0-7adc20808854`

- AZURE_CLIENT_SECRET - Azure Client Secret generated for the application.

eg: `NMubGVcDqkwwGnCs6fa01tqlkTisfUd4pBBYgcxxx=`

- AZURE_TENANT - Azure Active Directory tenant name or tenant ID.

eg: `default`

- AZURE_SUBSCRIPTION_ID - ID of the subscription for the Azure resources.

eg: `67ba6f2b-8i5y-4f5c-8ae0-7adc20808980`

- AZURE_RESOURCE_GROUP - Azure Resource Group to discover IP addresses.

eg: `wso2cluster`

- AZURE_API_ENDPOINT - Azure Resource Manager API Endpoint.

eg: `https://management.azure.com`

- AZURE_API_VERSION - Azure API Version.

eg: `2021-03-01`

If you have any suggestions or questions about the Azure Membership Scheme, don’t forget to leave a comment.

Have a nice day!

### References

1. [https://learn.microsoft.com/en-us/azure/role-based-access-control/resource-provider-operations#microsoftnetwork](https://learn.microsoft.com/en-us/azure/role-based-access-control/resource-provider-operations#microsoftnetwork)