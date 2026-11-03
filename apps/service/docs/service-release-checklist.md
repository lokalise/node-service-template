# Service readiness checklist

This document aims to provide a checklist for determining whether service is mature enough for general availability.

## Checklist

Legend: `M` - Mandatory, `R` - Recommended

### Documentation

- `M`: README.md in the repository:
  - service description, ownership, links to documentation,
    build and deployment instructions, configuration variables, healthchecks, etc
- `R`: Architectural diagram for the service
- `R`: SLI/SLO/SLA definitions (at least service criticality level: P1/2/3)

### Build and release pipeline

- `M`: GitHub Actions worklows for building the code, running linting check and executing tests
- `M`: Artifacts are container images

### Infrastructure

- `M`: All persistent state (if any) is stored in external storage
- `M`: All components must be designed for HA (e.g. an app should be able to run as
  multiple instances in active/active configuration)
- `M`: Deployment diagram
- `M`:
  - traffic types (HTTP/gRPC/other)
  - spikes / static IP address
  - adv L7 feat.: waf/auth/sticky sessions/request routing/load balancing algs
  - CORS requirements

### Security

- `M`: No secrets in the code
- `M`: Any housekeeping/one-off/migration/etc tasks must be part of the
  application; `stage` and `live` environment are not accessible directly.
- `M`: Externally exposed services must require authentication
- `M`: Documentation must have answers for the following questions:
  - Is this internal or external service?
  - Does the service make any outbound connections? If yes, specify destinations.
  - Does the service handle personally identifiable information?
- `R`: HTTP headers / CORS:
  - `X-Frame-Options`, `Strict-Transport-Security`, `X-XSS-Protection`,
    `X-DNS-Prefetch-Control`

### Operations

- `M`: Application configuration is set via environment variables
- `M`: Logging satisfies the following requirements:
  - single-line json to stdout/stderr, `message` or `msg` field at the root level
  - make sure data types for json fields aren't mixed otherwise parsing will not work
  - at least two verbosity levels: debug/error;
    - `error`: unexpected error that prevents further processing
    - `warn` : irregular events with defined recovery strategy
    - `info` : major state changes; must log: component start, became operational,
      event/task processed, shutdown started, just before exited
    - `debug`: diagnostic and troubleshooting event
  - global error handler; make sure all errors are logged
  - error response structure adheres to defined standard
  - field `level` must contain a string (error, warn) and not a number
  - distributed tracing:
    - request id is passed via `x-request-id` header, must propagate if received, otherwise generate a new one
    - request id must be included with the request-scoped logging and outgoing HTTP requests
- `M`: Implements APM integration
- `M`: Healthcheck endpoint; should provide:
  - at a minimum: 200 response if the service is operational, non-200 response code otherwise
  - include app version and commit hash in the response
  - recommended: [readiness and liveness endpoints]
- `M`: Implements metrics:
  - 4 golden signals: latency/traffic/errors/saturation
  - endpoint (preferably `/metrics`) in Prometheus format on a separate port (eg `9090`)
  - availability, authentication status, and latency for all backend services
  - Node.js metrics
  - business metrics as necessary/defined by the service owner
- `R`: Perform simple load testing of the service, use the results for:
  - sizing the live infrastructure; eg cores, RAM, storage size
  - define alerting thresholds; eg: 4 golden signals, latency/traffic(req cnt)/error/saturation

### Resiliency

- `M`: The service can run in multiple instances simultaneously
- `M`: Must handle component unavailability gracefully (eg. unable to connect to storage):
  - all connections must have reasonable timeouts and error handling
  - all HTTP calls must have reasonable timeouts and error handling
  - reconnect with exponential back-off where necessary
- `M`: [Graceful shutdown] on SIGTERM (15): stop accepting connections, complete in-flight work, exit

## References

- https://www.opslevel.com/blog/production-readiness-in-depth#deployment
- https://gruntwork.io/devops-checklist/
- https://aleksei-kornev.medium.com/production-readiness-checklist-for-backend-applications-8d2b0c57ccec
- https://github.com/mercari/production-readiness-checklist/blob/master/docs/references/pre-production-checklist.md
- https://blog.last9.io/deployment-readiness-checklists/
- https://habr.com/en/post/438186/
- https://12factor.net
- https://cloud.google.com/blog/products/containers-kubernetes/your-guide-kubernetes-best-practices

[readiness and liveness endpoints]: https://cloud.google.com/blog/products/containers-kubernetes/kubernetes-best-practices-setting-up-health-checks-with-readiness-and-liveness-probes
[Graceful shutdown]: https://cloud.google.com/blog/products/containers-kubernetes/kubernetes-best-practices-terminating-with-grace

This document is based on a Lokalise Service Release Checklist, prepared by the Lokalise Platform Squad.
