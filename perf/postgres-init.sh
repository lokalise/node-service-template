#!/usr/bin/env bash
# Creates pg_stat_statements in the perf database, which is what lets perf/probe report the
# statements and rows a journey cost. The extension also needs the shared_preload_libraries
# line in docker-compose.perf.yml, and that half needs a restart, which is why it is not here.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
	CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
EOSQL
