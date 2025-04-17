# Environment variables

In development, environment variables are resolved from the .env file
In production you are expected to set environment variables during deployment (e. g. using Vault)
For tests there are some overrides defined in [envSetupHook.ts](../test/envSetupHook.ts)

## List of environment variables

### app

- `NODE_ENV` - app execution mode. Supported values: `production` | `development` | `test`
- `APP_ENV` - environment, in which app is running. Supported values: `production` | `development` | `staging`
- `APP_BIND_ADDRESS` - address, on which server will be listening for HTTP(S) connections. e. g. `0.0.0.0`
- `LOG_LEVEL` - logs starting from which level should be emitted. Supported values: `fatal` | `error` | `warn` | `info` | `debug` | `trace` | `silent`
- (OPTIONAL) `APP_PORT` - port, on which server will be listening for HTTP(S) connections (`3000`)
- (OPTIONAL) `APP_VERSION` - application version, exposed via healthcheck endpoint (`VERSION_NOT_SET`)
- (OPTIONAL) `BASE_URL` - URL where the app is available externally, used in OpenAPI specification (default: `http://${APP_BIND_ADDRESS}:{APP_PORT}`)
- (OPTIONAL) `GIT_COMMIT_SHA` - SHA of a last commit of the deployed version (`COMMIT_SHA_NOT_SET`)
- `DATABASE_URL` - full DB connection URL. e. g. 'postgresql://serviceuser:pass@localhost:5432/service_db'
- `JWT_PUBLIC_KEY` - full public key for JWT token validation, with '||' replaced with new lines, e. g.
  ```
    -----BEGIN PUBLIC KEY-----
    MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAzi4k4ful8Q65RWbHvZwD
    jKNfspb89typkUATf8KXlYcWp6ibUG9nKpYrig3jmlCdMvCm+S7kZedACshFyRmm
    1ocaWjRIt/jJyzntxnMIgWetTedZXXzlFbparDMrdEMmsPbM7LrByCU57iKloZEl
    BhOSQZk/JbJK1YpozTCxcs28YlpnTuMBaXvXddrQuNHo+HYhK53XlFXyiOBzmEFY
    cBrVqptdjA3z7uNNd6A4IAfEkRYp4lZxZgwTPyjYZ1oXmhalvbr6OAs9ujLIZPSM
    QoP1VoHLdOqrs7QTmi2rrNCfIcFkFp02N39TovMm9zZQJjQvFEJqIKe4db2457vr
    uJ5qxkWmbBu+/tf6ytKfbiA433neLSvpfquPXbq3OLGzJ4H2YHiHa0ddfUCqdN49
    t5nCPEMp6OTa5kXuwObf8yvHyoP8HgQQD+/sftHUIE/1sdQ6fzB/9L+smzp5SW/X
    nI8NY0k1SH9MLlweGuXi6M1jS62kPWk4HTDQmiqUTImcG0XYRrVd5ISXPdfnVgnq
    KKht+SUmkPrfaWMDc21FsXXmmVSRTjvBhA6Cy6PLPzGZaeA4TVkOZUkp1OvcyfiI
    HixuZca1OASxGeUM8lcPi9my8TJCtw5ZR0M/uqVV/1o3U0nx+U5z54ulWN9leMLY
    vgv+lGrqfFWRemajGXSm8L0CAwEAAQ==
    -----END PUBLIC KEY-----
  ```
- (OPTIONAL) `METRICS_ENABLED` - whether to enable `metricsPlugin` (`true`)

### redis

- `REDIS_HOST` - Redis DB host
- `REDIS_PORT` - Redis DB port
- `REDIS_USERNAME` - Redis DB username
- `REDIS_PASSWORD` - Redis DB password
- `REDIS_KEY_PREFIX` - prefix to prepend to all keys in a command
- (OPTIONAL) `REDIS_USE_TLS` - whether to use https connection (`true`)
- (OPTIONAL) `REDIS_CONNECT_TIMEOUT` - if set, the milliseconds before a timeout occurs during the initial connection to the Redis server.
- (OPTIONAL) `REDIS_COMMAND_TIMEOUT` - if set, and a command does not return a reply within a set number of milliseconds, a "Command timed out" error will be thrown.
- `SCHEDULER_REDIS_HOST` - scheduling Redis instance host
- `SCHEDULER_REDIS_PORT` - scheduling Redis instance port
- `SCHEDULER_REDIS_USERNAME` - scheduling Redis instance username
- `SCHEDULER_REDIS_PASSWORD` - scheduling Redis instance password
- `SCHEDULER_REDIS_KEY_PREFIX` - scheduling Redis instance prefix to prepend to all keys in a command
- (OPTIONAL) `SCHEDULER_REDIS_USE_TLS` - whether to use https connection for scheduling Redis instance (`true`)
- (OPTIONAL) `SCHEDULER_REDIS_CONNECT_TIMEOUT` - if set, the milliseconds before a timeout occurs during the initial connection to the Redis server.
- (OPTIONAL) `SCHEDULER_REDIS_COMMAND_TIMEOUT` - if set, and a command does not return a reply within a set number of milliseconds, a "Command timed out" error will be thrown.

### amqp

- `AMQP_HOSTNAME` - AMQP broker host
- `AMQP_PORT` - AMQP broker port
- `AMQP_USERNAME` - AMQP broker username
- `AMQP_PASSWORD` - AMQP broker password
- (OPTIONAL) `AMQP_VHOST` - AMQP broker vhost
- (OPTIONAL) `AMQP_USE_TLS` - whether to use https connection for AMQP broker (`true`)

### aws

- `AWS_REGION` - AWS region
- (OPTIONAL) `AWS_ACCESS_KEY_ID` - AWS access key ID
- (OPTIONAL) `AWS_SECRET_ACCESS_KEY` - AWS secret access key
- (OPTIONAL) `AWS_KMS_KEY_ID` - AWS KMS key ID
- (OPTIONAL) `AWS_ALLOWED_SOURCE_OWNER` - AWS allowed source owner
- (OPTIONAL) `AWS_SNS_ENDPOINT` - AWS SNS endpoint
- (OPTIONAL) `AWS_SNS_TOPIC_NAME_PATTERN` - AWS SNS topic name pattern
- (OPTIONAL) `AWS_SQS_ENDPOINT` - AWS SQS endpoint
- (OPTIONAL) `AWS_SQS_QUEUE_NAME_PATTERN` - AWS SQS queue name pattern

## new relic

- (OPTIONAL) `NEW_RELIC_LICENSE_KEY` - New Relic API key
- (OPTIONAL) `NEW_RELIC_APP_NAME` - instrumented application name for New Relic grouping purposes
- (OPTIONAL) `NEW_RELIC_ENABLED` - whether to use New Relic instrumentation (`true`)
- (OPTIONAL) `NEW_RELIC_LABELS` - tags/labels to apply to your reporting in the format key:value

### bugsnag

- (OPTIONAL) `BUGSNAG_KEY` - BugSnag API key
- (OPTIONAL) `BUGSNAG_ENABLED` - whether to send errors to BugSnag (`true`)
- (OPTIONAL) `BUGSNAG_APP_TYPE` - type of app process running

### docker compose

- (OPTIONAL) `DOCKER_REDIS_PORT` - Docker `redis` service port, for development purposes only (`6379`)
- (OPTIONAL) `DOCKER_RABBITMQ_CLIENT_PORT` - Docker `rabbitmq` service client port, for development purposes only (`5672`)
- (OPTIONAL) `DOCKER_RABBITMQ_MANAGEMENT_PORT` - Docker `rabbitmq` service management port, for development purposes only (`15672`)

### amplitude

- (OPTIONAL) `AMPLITUDE_ENABLED` - Amplitude enabled (`false`)
- (OPTIONAL) `AMPLITUDE_KEY` - Amplitude source API key
- (OPTIONAL) `AMPLITUDE_SERVER_ZONE` - Amplitude server zone (`EU`). Supported values: `EU` | `US`
- (OPTIONAL) `AMPLITUDE_FLUSH_INTERVAL_MILLIS` - Sets the interval of uploading events to Amplitude in milliseconds. (`10000`)
- (OPTIONAL) `AMPLITUDE_FLUSH_QUEUE_SIZE` - Sets the maximum number of events that are batched in a single upload attempt. (`300`)
- (OPTIONAL) `AMPLITUDE_FLUSH_MAX_RETRIES` - Sets the maximum number of retries for failed upload attempts. This is only applicable to retry-able errors. (`12`)

### Jobs
- (OPTIONAL) `SEND_EMAILS_JOB_CRON` - send emails job cron expression
- `PROCESS_LOGS_FILES_JOB_PERIOD_IN_SECS` - period in seconds for processing logs files job
- `DELETE_OLD_USERS_JOB_PERIOD_IN_SECS` - period in seconds for deleting old users job

### Integrations
- (OPTIONAL) `SAMPLE_FAKE_STORE_BASE_URL` - fake store base URL
