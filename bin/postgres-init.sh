#!/usr/bin/env bash
# Cria o banco "evolution" no postgres compartilhado, se ainda não existir.
# Executado uma vez pelo entrypoint do container postgres (na primeira subida).
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
  SELECT 'CREATE DATABASE evolution OWNER ${POSTGRES_USER}'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'evolution')\gexec
EOSQL
