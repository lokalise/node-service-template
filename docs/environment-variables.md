# Environment variables

## App

- `NODE_ENV` (required)  
  Type: `string`  
  Description: Application execution environment  
  Supported values: `production` | `test` | `development`

- `APP_ENV` (required)  
  Type: `string`  
  Description: Deployment environment for the application  
  Supported values: `production` | `staging` | `development`

- `APP_VERSION` (optional)  
  Type: `string`  
  Description: Application version exposed via healthcheck endpoint  
  Default: `VERSION_NOT_SET`

- `GIT_COMMIT_SHA` (optional)  
  Type: `string`  
  Description: Git commit SHA of the deployed version  
  Default: `COMMIT_SHA_NOT_SET`

- `APP_PORT` (optional)  
  Type: `integer`  
  Description: HTTP server listening port  
  Min value: `0`  
  Max value: `65535`  
  Default: `3000`

- `APP_BIND_ADDRESS` (required)  
  Type: `string`  
  Description: HTTP server binding address (e.g., 0.0.0.0 for all interfaces)

- `JWT_PUBLIC_KEY` (required)  
  Type: `string`  
  Description: JWT validation public key (use '||' as newline separator)

- `LOG_LEVEL` (required)  
  Type: `string`  
  Description: Minimum log level for emitted logs  
  Supported values: `fatal` | `error` | `warn` | `info` | `debug` | `trace` | `silent`

- `BASE_URL` (optional)  
  Type: `string`  
  Description: Public URL where the application is accessible, used in OpenAPI spec  
  Default: ``

## App Metrics

- `METRICS_ENABLED` (optional)  
  Type: `string`  
  Description: Whether to enable Prometheus metrics collection  
  Default: `true`

## Db

- `DATABASE_URL` (required)  
  Type: `string`  
  Description: PostgreSQL connection URL including credentials and database name

## Redis

- `REDIS_HOST` (required)  
  Type: `string`  
  Description: Redis server hostname

- `REDIS_KEY_PREFIX` (required)  
  Type: `string`  
  Description: Prefix for all Redis keys

- `REDIS_PORT` (required)  
  Type: `integer`  
  Description: Redis server port  
  Min value: `0`  
  Max value: `65535`

- `REDIS_USERNAME` (optional)  
  Type: `string`  
  Description: Redis authentication username

- `REDIS_PASSWORD` (optional)  
  Type: `string`  
  Description: Redis authentication password

- `REDIS_USE_TLS` (optional)  
  Type: `string`  
  Description: Whether to use TLS/SSL for Redis connection  
  Default: `true`

- `REDIS_COMMAND_TIMEOUT` (optional)  
  Type: `integer`  
  Description: Command execution timeout in milliseconds  
  Min value: `0`  
  Max value: `9007199254740991`

- `REDIS_CONNECT_TIMEOUT` (optional)  
  Type: `integer`  
  Description: Initial connection timeout in milliseconds  
  Min value: `0`  
  Max value: `9007199254740991`

## Scheduler

- `SCHEDULER_REDIS_HOST` (required)  
  Type: `string`  
  Description: Scheduler Redis server hostname

- `SCHEDULER_REDIS_KEY_PREFIX` (required)  
  Type: `string`  
  Description: Prefix for all scheduler Redis keys

- `SCHEDULER_REDIS_PORT` (required)  
  Type: `integer`  
  Description: Scheduler Redis server port  
  Min value: `0`  
  Max value: `65535`

- `SCHEDULER_REDIS_USERNAME` (optional)  
  Type: `string`  
  Description: Scheduler Redis authentication username

- `SCHEDULER_REDIS_PASSWORD` (optional)  
  Type: `string`  
  Description: Scheduler Redis authentication password

- `SCHEDULER_REDIS_USE_TLS` (optional)  
  Type: `string`  
  Description: Whether to use TLS/SSL for scheduler Redis connection  
  Default: `true`

- `SCHEDULER_REDIS_COMMAND_TIMEOUT` (optional)  
  Type: `integer`  
  Description: Scheduler command execution timeout in milliseconds  
  Min value: `0`  
  Max value: `9007199254740991`

- `SCHEDULER_REDIS_CONNECT_TIMEOUT` (optional)  
  Type: `integer`  
  Description: Scheduler initial connection timeout in milliseconds  
  Min value: `0`  
  Max value: `9007199254740991`

## Amqp

- `AMQP_HOSTNAME` (required)  
  Type: `string`  
  Description: AMQP broker hostname

- `AMQP_PORT` (required)  
  Type: `integer`  
  Description: AMQP broker port  
  Min value: `0`  
  Max value: `65535`

- `AMQP_USERNAME` (required)  
  Type: `string`  
  Description: AMQP broker username

- `AMQP_PASSWORD` (required)  
  Type: `string`  
  Description: AMQP broker password

- `AMQP_VHOST` (optional)  
  Type: `string`  
  Description: AMQP broker virtual host  
  Default: ``

- `AMQP_USE_TLS` (optional)  
  Type: `string`  
  Description: Whether to use TLS/SSL for AMQP connection  
  Default: `true`

## Aws

- `AWS_REGION` (required)  
  Type: `string`  
  Description: AWS region for resource management  
  Min length: `1`

- `AWS_KMS_KEY_ID` (optional)  
  Type: `string`  
  Description: KMS key ID for encryption/decryption  
  Default: ``

- `AWS_ALLOWED_SOURCE_OWNER` (optional)  
  Type: `string`  
  Description: AWS account ID for permitted request source

- `AWS_ENDPOINT` (optional)  
  Type: `string`  
  Description: Custom AWS service endpoint URL  
  Format: `uri`

- `AWS_RESOURCE_PREFIX` (optional)  
  Type: `string`  
  Description: Prefix for AWS resource names (max 10 chars)  
  Max length: `10`

- `AWS_ACCESS_KEY_ID` (optional)  
  Type: `string`  
  Description: AWS access key ID for programmatic access

- `AWS_SECRET_ACCESS_KEY` (optional)  
  Type: `string`  
  Description: AWS secret access key for programmatic access

- `_AWS_CREDENTIALS_RESOLVED` (optional)  
  Type: `undefined`  
  Description: Auto-resolved from AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY. Do not configure directly.

## Integrations FakeStore

- `SAMPLE_FAKE_STORE_BASE_URL` (required)  
  Type: `string`  
  Description: Base URL for the fake store API integration

## Jobs DeleteOldUsersJob

- `DELETE_OLD_USERS_JOB_PERIOD_IN_SECS` (required)  
  Type: `integer`  
  Description: Period in seconds for deleting old users job  
  Min value: `0`  
  Max value: `9007199254740991`

## Jobs ProcessLogFilesJob

- `PROCESS_LOGS_FILES_JOB_PERIOD_IN_SECS` (required)  
  Type: `integer`  
  Description: Period in seconds for processing log files job  
  Min value: `0`  
  Max value: `9007199254740991`

## Jobs SendEmailsJob

- `SEND_EMAILS_JOB_CRON` (required)  
  Type: `string`  
  Description: Cron expression for scheduling the send emails job

## Vendors Opentelemetry

- `OTEL_ENABLED` (optional)  
  Type: `string`  
  Description: Whether to enable OpenTelemetry instrumentation    
  Default: `true`

## Vendors Bugsnag

- `BUGSNAG_ENABLED` (optional)  
  Type: `string`  
  Description: Whether to send errors to Bugsnag  
  Default: `true`

- `BUGSNAG_KEY` (optional)  
  Type: `string`  
  Description: Bugsnag API key for error submission

- `BUGSNAG_APP_TYPE` (optional)  
  Type: `string`  
  Description: Application process type identifier for Bugsnag

## Vendors Amplitude

- `AMPLITUDE_ENABLED` (optional)  
  Type: `string`  
  Description: Whether to track analytics with Amplitude  
  Default: `false`

- `AMPLITUDE_KEY` (optional)  
  Type: `string`  
  Description: Amplitude API key for event submission

- `AMPLITUDE_SERVER_ZONE` (optional)  
  Type: `string`  
  Description: Amplitude data residency region  
  Supported values: `EU` | `US`  
  Default: `EU`

- `AMPLITUDE_FLUSH_INTERVAL_MILLIS` (optional)  
  Type: `integer`  
  Description: Event batch upload interval in milliseconds  
  Min value: `0`  
  Max value: `9007199254740991`  
  Default: `10000`

- `AMPLITUDE_FLUSH_QUEUE_SIZE` (optional)  
  Type: `integer`  
  Description: Maximum events per batch upload  
  Min value: `0`  
  Max value: `9007199254740991`  
  Default: `300`

- `AMPLITUDE_FLUSH_MAX_RETRIES` (optional)  
  Type: `integer`  
  Description: Maximum retry attempts for failed uploads  
  Min value: `0`  
  Max value: `9007199254740991`  
  Default: `12`
