# Logging

## Why

All software has bugs. Bugs cause issues in production, and when that happens, we have to be able to quickly understand what exactly has happened, what led to it and what was the context in which it has happened.

Sometimes we are able to do that by observing up-to-date state in the database, but more often than not this is not enough. Many issues are transient and cause an invalid state only in the moment of execution.

Logs provide us a mechanism for

- capturing an exact sequence of the events;
- documenting the context in which the events have occured;
- fast and convenient lookup of events related to an event under investigation.

## What

### Payload

In order to effectively solve the problem outlined in the previous section, logs must satisfy the following criteria:

- It should be easy to link different log entries for the same flow together. For that purpose a x-request-id log entry should be added to all log entries that belong to a particular flow:

For REST API calls this value is automatically filled by `req.reqContext.logger`, which should be preferred over a global logger, which doesn’t have the request context;

- For message handlers this value is automatically populated with the `message.metadata.correlationId`.

- In order to preserve `x-request-id` across the multiple webservices involved in the flow, all API calls to other webservices must include `reqContext` or explicitly set the `x-request-id` header.

- It should be easy to understand what has happened:

  - message field must include clear, human-readable, unambiguous explanation of what has happened;
  - identifiers of key entities involved in the current step of the flow (e. g. a user or content unit) must be included (e. g. as fields `userId` and `contentUnitId`);
  - All significant steps of the flow should have a separate log entry, so that it is easy to determine which steps have occurred prior to the issue, and which may have not happened at all.

- You must avoid logging sensitive data (passwords, personally identifiable information like names and emails) and should avoid logging user-generated content, unless absolutely needed.
  - Consider using pino redaction functionality for handling sensitive data.

### Level

We recommend using the following logging levels:

- ERROR: Something has failed during the execution of the flow, and this is our fault. We have to fix it. Everything with a log level ERROR should also be reported to BugSnag, and needs to be investigated and addressed with a high priority. Everything that doesn’t need to be fixed shouldn’t use the ERROR level, so that there is a clear visibility of real issues.

  - Example of an error: connection failure when sending a request, and all the retries have failed

- WARN: Whenever there is a system behaviour that deviates from expected, but isn’t necessarily an issue, we use WARN log level. This level requires attention of engineers, but doesn’t always require action;

  - Examples of warnings: an operation took longer to execute than the expected threshold, or some parameter had an unexpected value, but that wasn’t critical for the execution of the flow

- INFO: When a domain event has happened, we create an INFO log entry.

  - Examples: user was created, Translation was reviewed.

- DEBUG: When a meaningful internal event has happened, we create a DEBUG entry.
  - Examples: user was persisted to a database, an event was published. DEBUG entries communicate implementation details.

## When

Every flow (an HTTP request, a background job and a consumer handler execution) must have logs, signifying the beginning and the completion (or failure) of the flow;

- Background jobs automatically log start and end of the execution when they extend `AbstractBackgroundJobProcessor`.
- `requestContext` instance populated with execution-scoped logger and execution `reqId` are passed to the process method of every execution.
- When job calls a domain service (e. g. `userService`) or makes an HTTP call, it must pass its `requestContext` for logging and distributed tracing purposes.

- Consumers automatically log beginning and completion of a message processing when `logMessages` parameter is set to true.
- When consumer calls a service or makes an HTTP call, it must pass its `requestContext` to populate the `x-request-id` of the call.
- Publishers automatically log messages published when `logMessages` parameter is set to true. This is done automatically for publishers that extend AutopilotMultiPublisher or that are used through AutopilotPublisherManager
- Controllers automatically log incoming requests when log level debugger trace is set.
- Services require manual logs. Make sure to pass `requestContext` entity from controller and use it for logging.

Every major stage in the flow should have a log, signifying transition from one stage to the other;
