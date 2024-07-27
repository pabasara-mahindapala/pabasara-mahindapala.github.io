---
layout: post
title: Implementing CQRS in ASP.NET Core - Separating Read and Write Operations for Scalability and Performance
published: true
description: Implementing CQRS in ASP.NET Core - Separating Read and Write Operations for Scalability and Performance
categories: [software-development, software-architecture]
tags: [software, programming, coding, software-architecture, csharp, c#, aspnet-core, cqrs, command-query-responsibility-segregation, scalability, performance]
---

<!-- <div class="message">
    <small>
  This article was originally published on <a href="https://towardsdev.com/monitoring-java-applications-on-azure-with-application-insights-246d6758337a">Towards Dev</a>.
    </small>
</div> -->

I have recently followed a course on Linkedin Learning titled [Software Architecture: Patterns for Developers](https://www.linkedin.com/learning/software-architecture-patterns-for-developers) by Peter Morlion. In this course, I learned about the Command Query Responsibility Segregation (CQRS) pattern and I was interested to try it out in ASP.NET Core. In this article, I will walk you through my approach to implementing CQRS in a ASP.NET Core Web API project.

### Understanding CQRS

Command Query Responsibility Segregation (CQRS) is a pattern that separates the responsibility of reading and writing data. In a traditional application, we usually have a single model that is used to read and write data. CQRS introduces two separate models, one for reading data and one for writing data. The model for reading data (read model) is optimized for reading data and the model for writing data (write model) is optimized for writing data.

Let's define Commands and Queries:

1. **Commands**: These operations change the system's state and may or may not return data.
2. **Queries**: These operations retrieve data from the system without modifying its state.

Why is this required? What possible benefits can be achieved by taking the effort to implement this pattern?

### Benefits of CQRS

One of the main advantages of CQRS is the ability to scale the read and write operations independently. In traditional applications, scaling both operations together is necessary. Having the isolation between read and write models allows more flexibility and allows individual models to be updated without affecting the other. Additionally, implementing CQRS gives the ability to optimize the read model and write model separately for performance.

However, implementing CQRS comes with trade-offs.

### Considerations and Trade-offs

One of the main disadvantages is the increased complexity of the system from this pattern. CQRS is not suitable for simple CRUD applications, as it would add unnecessary complexity to the system. It is best suited for complex business domains where the benefits of implementing CQRS outweigh the complexity it adds. 

Another concern is maintaining the consistency between the read model and the write model. Additional effort is required to synchronize the data between the two models to ensure consistency. Eventual consistency is a common approach to handle this, where the read model is eventually consistent with the write model.

CQRS can also lead to code duplication and increased development time since there is an associated learning curve.

### Implementation of CQRS

Now let's dive into the implementation.

First I built a simple CRUD application for managing contacts. The application has three entities: User, Contact, and Address. A user can have contacts of different types (email, phone, etc.) and addresses in different states.

You would see that a simple CRUD application like this does not have a use case for CQRS. However, we will use this application to demonstrate how CQRS can be implemented.

I created the domain models and a repository which uses a SQLite database to persist the data. Tables for each entity were created in the database.

```csharp
public class User
{
    public string Id { get; set; }
    public string FirstName { get; set; }
    public string LastName { get; set; }
    public List<Contact> Contacts { get; set; }
    public List<Address> Addresses { get; set; }
}

public class Contact
{
    public string Id { get; set; }
    public string Type { get; set; }
    public string Detail { get; set; }
    public string UserId { get; set; }
}

public class Address
{
    public string Id { get; set; }
    public string City { get; set; }
    public string State { get; set; }
    public string Postcode { get; set; }
    public string UserId { get; set; }
}
```

```csharp
public interface IUserRepository
{
    User Get(string userId);
    void Create(User user);
    void Update(User user);
    void Delete(string userId);
}
```

<script src="https://gist.github.com/pabasara-mahindapala/1f6d48dc2bb8225ca355bae4c5f37061.js"></script>

As you know, I can expose these simple CRUD operations from the repository as a service and use it in the ASP.NET Core controller. And our application would work just fine.

Instead, I need to separate the read and write operations into separate models to implement CQRS pattern in the application.

First I implemented the write side of the application.

I have defined two commands named CreateUserCommand and UpdateUserCommand. These commands are used to create the users and update their contacts and addresses.

```csharp
public class CreateUserCommand
{
    public string FirstName { get; set; }
    public string LastName { get; set; }
}

    public class UpdateUserCommand
{
    public string Id { get; set; }
    public List<Contact> Contacts { get; set; }
    public List<Address> Addresses { get; set; }
}
```

To handle the write operations, I created a new repository UserWriteRepository based on the previous UserRepository implementation.

```csharp
public interface IUserWriteRepository
{
    User Get(string userId);
    void Create(User user);
    void Update(User user);
    void Delete(string userId);
    Contact GetContact(string contactId);
    void CreateContact(Contact contact);
    void UpdateContact(Contact contact);
    void DeleteContact(string contactId);
    Address GetAddress(string addressId);
    void CreateAddress(Address address);
    void UpdateAddress(Address address);
    void DeleteAddress(string addressId);
}
```

<script src="https://gist.github.com/pabasara-mahindapala/d3d1703d5edb2d52e25cd0b889ff35d2.js"></script>

Next I have implemented a service named UserWriteService which uses the UserWriteRepository to handle the write operations.

```csharp
public interface IUserWriteService
{
    User HandleCreateUserCommand(CreateUserCommand command);
    User HandleUpdateUserCommand(UpdateUserCommand command);
}
```

<script src="https://gist.github.com/pabasara-mahindapala/3c21117b8cdeee5b32611d3f0428392f.js"></script>

And that completes the write side of the application.

Next we will implement the read side of the application. When it comes to the read operations, note that the data model should be independent of the write model and optimized only for reading data.

We need to define the read model suited to the read operations that we have in the application. In this ASP.NET Core application, end users should be able to get the contact details of a particular user according to the contact type, and the address of a particular user according to the state.

To achieve this, I have defined two queries:

```csharp
public class ContactByTypeQuery
{
    public string UserId { get; set; }
    public string ContactType { get; set; }
}

    public class AddressByStateQuery
{
    public string UserId { get; set; }
    public string State { get; set; }
}
```

I will define two models UserAddress and UserContact to represent the read model.

```csharp
public class UserAddress
{
    public string UserId { get; set; }
    public Dictionary<string, AddressByState> AddressByStateDictionary { get; set; }
}

    public class UserContact
{
    public string UserId { get; set; }
    public Dictionary<string, ContactByType> ContactByTypeDictionary { get; set; }
}
```

And I will create following database tables in the read model:

```sql
CREATE TABLE UserAddresses
(
    UserId NVARCHAR(255) NOT NULL,
    AddressByStateId NVARCHAR(255) NOT NULL,
    FOREIGN KEY(AddressByStateId) REFERENCES AddressByState(Id),
    PRIMARY KEY(UserId, AddressByStateId)
);

CREATE TABLE AddressByState
(
    Id NVARCHAR(255) PRIMARY KEY,
    State NVARCHAR(255) NOT NULL,
    City NVARCHAR(255) NOT NULL,
    Postcode NVARCHAR(255) NOT NULL
);

CREATE TABLE UserContacts
(
    UserId NVARCHAR(255) NOT NULL,
    ContactByTypeId NVARCHAR(255) NOT NULL,
    FOREIGN KEY(ContactByTypeId) REFERENCES ContactByType(Id),
    PRIMARY KEY(UserId, ContactByTypeId)
);

CREATE TABLE ContactByType
(
    Id NVARCHAR(255) PRIMARY KEY,
    Type NVARCHAR(255) NOT NULL,
    Detail NVARCHAR(255) NOT NULL
);
```

To handle the read operations, we need to define a new repository called UserReadRepository.

```csharp
public interface IUserReadRepository
{
    UserContact GetUserContact(string userId);
    UserAddress GetUserAddress(string userId);
}
```

<script src="https://gist.github.com/pabasara-mahindapala/a1414074f4d742c1b8da8c6b3222c2da.js"></script>

Next, I have implemented a service named UserReadService which uses the UserReadRepository to handle the read operations.

```csharp
public interface IUserReadService
{
    ContactByType Handle(ContactByTypeQuery query);
    AddressByState Handle(AddressByStateQuery query);
}
```

Now we can read the required data from the read model tables and return the expected results.

But you'll notice that the read model tables are empty and we didn't add any data to them.

How do these read model tables get updated when a user is created or updated from the write model? To achieve this, we need to implement a mechanism to synchronize the data between the read and write models.

I have implemented a UserProjector to handle this synchronization.

```csharp
public interface IUserProjector
{
    void Project(User user);
}
```

<script src="https://gist.github.com/pabasara-mahindapala/619308ce177314834d76d94827362f0c.js"></script>

Ideally, this synchronization should be done asynchronously to avoid blocking the write operations. But for simplicity, I have called the project method synchronously in the UserWriteService.

```csharp
public User HandleUpdateUserCommand(UpdateUserCommand command)
{
    User user = _userWriteRepository.Get(command.Id);
    user.Contacts = UpdateContacts(user, command.Contacts);
    user.Addresses = UpdateAddresses(user, command.Addresses);
    _userProjector.Project(user);
    return user;
}
```

With the synchronization in place, the read model tables will be updated whenever a user is updated. 

And that completes the implementation of the CQRS pattern in the application.

> The source code for this application can be found in the <a href="https://github.com/pabasara-mahindapala/ContactBook">GitHub repo</a>

Follow the below steps to run the application:

 1. Clone the repository.
 2. Run the `recreate-database.bat` file to create the database tables.
 3. Open the `ContactBook.sln` file in Visual Studio.
 4. Run the application.
 5. Use the Swagger UI to test the API endpoints for creating, updating, and reading user contacts.

### Conclusion

In this article, my aim was to demonstrate how to implement the CQRS pattern in an ASP.NET Core application. In my next article, I will try to implement Event Sourcing along with CQRS in this application.

If you have any questions or feedback, please feel free to share.

Thank you for reading!

### See Also

1. [https://github.com/gregoryyoung/m-r/tree/master/SimpleCQRS](https://github.com/gregoryyoung/m-r/tree/master/SimpleCQRS)

2. [https://www.baeldung.com/cqrs-event-sourcing-java](https://www.baeldung.com/cqrs-event-sourcing-java)

3. [https://www.confluent.io/learn/cqrs/](https://www.confluent.io/learn/cqrs/)

<style>
.gist {
   overflow:auto;
}

.gist .blob-wrapper.data {
   max-height:300px;
   overflow:auto;
}
</style>