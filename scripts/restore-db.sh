#!/bin/bash
# restore-db.sh — Restore a PostgreSQL backup via docker-compose
#
# Usage:
#   ./scripts/restore-db.sh <BACKUP_FILE>
#
# Accepts both .sql and .sql.gz files. The restore drops and recreates the
# target database, so existing data will be replaced.
#
# Environment variables (read from .env.production if present):
#   POSTGRES_USER  (default: postgres)
#   POSTGRES_DB    (default: testops)

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <backup_file.sql[.gz]>"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "[restore-db] ERROR: File not found: ${BACKUP_FILE}"
  exit 1
fi

# Load .env.production if available
ENV_FILE=".env.production"
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

PG_USER="${POSTGRES_USER:-postgres}"
PG_DB="${POSTGRES_DB:-testops}"

echo "[restore-db] WARNING: This will REPLACE all data in '${PG_DB}'."
echo "[restore-db] Backup file: ${BACKUP_FILE}"

# Prompt for confirmation unless running non-interactively (CI/scripts)
if [ -t 0 ]; then
  read -r -p "[restore-db] Continue? (y/N) " confirm
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "[restore-db] Aborted."
    exit 0
  fi
fi

echo "[restore-db] Dropping and recreating database '${PG_DB}' ..."

# Terminate existing connections, drop, and recreate the database
docker compose exec -T db psql -U "$PG_USER" -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${PG_DB}' AND pid <> pg_backend_pid();" \
  > /dev/null 2>&1 || true

docker compose exec -T db psql -U "$PG_USER" -d postgres -c "DROP DATABASE IF EXISTS \"${PG_DB}\";"
docker compose exec -T db psql -U "$PG_USER" -d postgres -c "CREATE DATABASE \"${PG_DB}\";"

echo "[restore-db] Restoring from backup ..."

# Decompress if gzipped, then pipe to psql
if [[ "$BACKUP_FILE" == *.gz ]]; then
  gunzip -c "$BACKUP_FILE" | docker compose exec -T db psql -U "$PG_USER" -d "$PG_DB"
else
  docker compose exec -T db psql -U "$PG_USER" -d "$PG_DB" < "$BACKUP_FILE"
fi

echo "[restore-db] Restore complete. Run 'npx prisma migrate deploy' if schema has changed."
