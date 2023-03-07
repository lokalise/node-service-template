# Environment variables

In development, environment variables are resolved from the .env file
In production you are expected to set environment variables during deployment (e. g. using Vault)

## List of environment variables

### app

- `NODE_ENV` - app execution mode. Supported values: `production` | `development` | `test`
- `APP_ENV` - environment, in which app is running. Supported values: `production` | `development` | `staging`
- `APP_BIND_ADDRESS` - address, on which server will be listening for HTTP(S) connections. e. g. `0.0.0.0`
- `LOG_LEVEL` - logs starting from which level should be emitted. Supported values: `fatal` | `error` | `warn` | `info` | `debug` | `trace` | `silent`
- (OPTIONAL) `APP_PORT` - port, on which server will be listening for HTTP(S) connections (`3000`)
- (OPTIONAL) `APP_VERSION` - application version, exposed via healthcheck endpoint (`VERSION_NOT_SET`)
- (OPTIONAL) `GIT_COMMIT_SHA` - SHA of a last commit of the deployed version (`COMMIT_SHA_NOT_SET`)
- `DATABASE_URL` - full DB connection URL. e. g. 'mysql://root:rootpass@localhost:3306/service_db'
- `JWT_PUBLIC_KEY` - full public key for JWT token validation, with newlines replaced with '||', e. g. `-----BEGIN PUBLIC KEY-----||MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAzi4k4ful8Q65RWbHvZwD||jKNfspb89typkUATf8KXlYcWp6ibUG9nKpYrig3jmlCdMvCm+S7kZedACshFyRmm||1ocaWjRIt/jJyzntxnMIgWetTedZXXzlFbparDMrdEMmsPbM7LrByCU57iKloZEl||BhOSQZk/JbJK1YpozTCxcs28YlpnTuMBaXvXddrQuNHo+HYhK53XlFXyiOBzmEFY||cBrVqptdjA3z7uNNd6A4IAfEkRYp4lZxZgwTPyjYZ1oXmhalvbr6OAs9ujLIZPSM||QoP1VoHLdOqrs7QTmi2rrNCfIcFkFp02N39TovMm9zZQJjQvFEJqIKe4db2457vr||uJ5qxkWmbBu+/tf6ytKfbiA433neLSvpfquPXbq3OLGzJ4H2YHiHa0ddfUCqdN49||t5nCPEMp6OTa5kXuwObf8yvHyoP8HgQQD+/sftHUIE/1sdQ6fzB/9L+smzp5SW/X||nI8NY0k1SH9MLlweGuXi6M1jS62kPWk4HTDQmiqUTImcG0XYRrVd5ISXPdfnVgnq||KKht+SUmkPrfaWMDc21FsXXmmVSRTjvBhA6Cy6PLPzGZaeA4TVkOZUkp1OvcyfiI||HixuZca1OASxGeUM8lcPi9my8TJCtw5ZR0M/uqVV/1o3U0nx+U5z54ulWN9leMLY||vgv+lGrqfFWRemajGXSm8L0CAwEAAQ==||-----END PUBLIC KEY-----`
- (OPTIONAL) `METRICS_ENABLED` - whether to enable `metricsPlugin` (`true`)

### redis

- `REDIS_HOST` - Redis DB host
- `REDIS_PORT` - Redis DB port
- `REDIS_USERNAME` - Redis DB username
- `REDIS_PASSWORD` - Redis DB password
- `REDIS_DB` - Redis DB database (number in 0-15 range)
- (OPTIONAL) `REDIS_USE_TLS` - whether to use https connection (`true`)
- `SCHEDULER_REDIS_HOST` - scheduling Redis instance host
- `SCHEDULER_REDIS_PORT` - scheduling Redis instance port
- `SCHEDULER_REDIS_USERNAME` - scheduling Redis instance username
- `SCHEDULER_REDIS_PASSWORD` - scheduling Redis instance password
- `SCHEDULER_REDIS_DB` - scheduling Redis instance database (number in 0-15 range)
- (OPTIONAL) `SCHEDULER_REDIS_USE_TLS` - whether to use https connection for scheduling Redis instance (`true`)

### amqp

- `AMQP_HOSTNAME` - AMQP broker host
- `AMQP_PORT` - AMQP broker port
- `AMQP_USERNAME` - AMQP broker username
- `AMQP_PASSWORD` - AMQP broker password
- (OPTIONAL) `AMQP_VHOST` - AMQP broker vhost
- (OPTIONAL) `AMQP_USE_TLS` - whether to use https connection for AMQP broker (`true`)

## new relic

- (OPTIONAL) `NEW_RELIC_LICENSE_KEY` - New Relic API key
- (OPTIONAL) `NEW_RELIC_APP_NAME` - instrumented application name for New Relic grouping purposes
- (OPTIONAL) `NEW_RELIC_ENABLED` - whether to use New Relic instrumentation (`true`)

### bugsnag

- (OPTIONAL) `BUGSNAG_KEY` - BugSnag API key
- (OPTIONAL) `BUGSNAG_ENABLED` - whether to send errors to BugSnag (`true`)

### docker compose

- (OPTIONAL) `DOCKER_MYSQL_PORT` - Docker `mysql` service port, for development purposes only (`3306`)
- (OPTIONAL) `DOCKER_REDIS_PORT` - Docker `redis` service port, for development purposes only (`6379`)
- (OPTIONAL) `DOCKER_RABBITMQ_CLIENT_PORT` - Docker `rabbitmq` service client port, for development purposes only (`5672`)
- (OPTIONAL) `DOCKER_RABBITMQ_MANAGEMENT_PORT` - Docker `rabbitmq` service management port, for development purposes only (`15672`)
