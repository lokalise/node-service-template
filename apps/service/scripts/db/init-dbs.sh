#!/bin/bash
set -e

export PGPASSWORD=$POSTGRES_PASSWORD

# Create additional databases
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE service_db_test;
EOSQL
