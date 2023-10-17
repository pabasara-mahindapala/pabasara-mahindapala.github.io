---
layout: post
title: Monitoring Java Applications on Azure with Application Insights
published: true
description: Monitoring Java Applications on Azure with Application Insights
categories: [software-development, azure]
tags: [wso2, azure, software, programming, coding, cloud, monitoring, application-insights]
---

<div class="message">
    <small>
  This article was originally published on <a href="https://towardsdev.com/monitoring-java-applications-on-azure-with-application-insights-246d6758337a">Towards Dev</a>.
    </small>
</div>

Monitoring of an application helps us to track aspects like resource usage, availability, performance and functionality. [Azure Monitor](https://learn.microsoft.com/en-us/azure/azure-monitor/overview) is a service available in Microsoft Azure that delivers a comprehensive solution for collecting, analyzing, and acting on telemetry data from our environments.

[Application Insights](https://learn.microsoft.com/en-us/azure/azure-monitor/app/app-insights-overview?tabs=java) is an extension of Azure Monitor that provides Application Performance Monitoring both proactively and reactively. Today I’m going to tell you how you can easily use Azure Application Insights to monitor Java applications.

_Please note that I have used [WSO2 Identity Server](https://wso2.com/identity-server/) in this article to demonstrate how to enable and configure Azure Application Insights for a Java Application._

### Prerequisites

- Java application (using Java 8+)
- Azure subscription

1. As the first step, we need to create an Application Insights resource in Azure as follows. You can find how to create an Application Insights resource from [here](https://learn.microsoft.com/en-us/azure/azure-monitor/app/create-workspace-resource#create-a-workspace-based-resource).

![Creating an Application Insights resource](/public/images/create-application-insights-resource.webp "Creating an Application Insights resource"){:.centered}

{:start="2"}
2. Next, we need to copy the connection string from the Application Insights resource we just created as shown below.

![Application Insights resource connection string](/public/images/application-insights-connection-string.webp "Application Insights resource connection string"){:.centered}

{:start="3"}
3. Create a file named **applicationinsights.json** with the following content. You should replace `<CONNECTION_STRING>` by the connection string copied above.

```json
{
  "connectionString": "<CONNECTION_STRING>"
}
```

{:start="4"}
4. Next, download the Application Insights agent for Java from [here](https://learn.microsoft.com/en-us/azure/azure-monitor/app/java-in-process-agent#download-the-jar-file). You should keep the **applicationinsights-agent-x.x.x.jar** file in the same directory as the **applicationinsights.json** file created above.

5. In our Java application, we should add a JVM argument as shown to point the JVM to the agent jar file. You need to update the path to the agent jar file.

```bash
-javaagent:"path/to/applicationinsights-agent-x.x.x.jar"
```

In my WSO2 Identity Server configuration, I have added the JVM argument in the <carbon_home>/bin/wso2server.sh file as shown below.

![Adding the JVM argument](/public/images/adding-jvm-argument.webp "Adding the JVM argument"){:.centered}

{:start="6"}
6. When the Azure Application Insights is correctly configured for the Java application, it can be observed in the logs as shown when the application is started.

![Application Insights Java Agent logs](/public/images/java-agent-logs.webp "Application Insights Java Agent logs"){:.centered}

Now we can observe real time telemetry data from our Java application running on Azure through the Application Insights resource.

![Application Insights Live Metrics](/public/images/live-metrics.webp "Application Insights Live Metrics"){:.centered}

We can get information like CPU percentage, committed memory, request duration and request failure rate from Application Insights under Live Metrics.

Additionally, we can use features like Log Analytics, Availability tests and Alerting through Azure Application Insights. You can read more about Application Insights [here](https://learn.microsoft.com/en-us/azure/azure-monitor/app/app-insights-overview?tabs=java).

Thank you for taking the time to read. Have a nice day!

### References

1. [https://learn.microsoft.com/en-us/azure/azure-monitor/overview](https://learn.microsoft.com/en-us/azure/azure-monitor/overview)

2. [https://learn.microsoft.com/en-us/azure/azure-monitor/app/app-insights-overview?tabs=java](https://learn.microsoft.com/en-us/azure/azure-monitor/app/app-insights-overview?tabs=java)

3. [https://wso2.com/identity-server/](https://wso2.com/identity-server/)

4. [https://learn.microsoft.com/en-us/azure/azure-monitor/app/create-workspace-resource](https://learn.microsoft.com/en-us/azure/azure-monitor/app/create-workspace-resource)