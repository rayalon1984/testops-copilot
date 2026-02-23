#!/bin/bash
# backup-db.sh — Create a compressed PostgreSQL backup via docker-compose
#
# Usage:
#   ./scripts/backup-db.sh [BACKUP_DIR]
#
# The backup is written as a gzipped SQL dump:
#   <BACKUP_DIR>/testops_backup_<YYYYMMDD_HHMMSS>.sql.gz
#
# Environment variables (read from .env.production if present):
#   POSTGRES_USER     (default: postgres)
#   POSTGRES_DB       (default: testops)
#   BACKUP_RETENTION  Number of days to keep old backups (default: 30)

set -euo pipefail

# Load .env.production if available (for POSTGRES_USER / POSTGRES_DB)
ENV_FILE=".env.production"
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/testops_backup_${TIMESTAMP}.sql.gz"
RETENTION_DAYS="${BACKUP_RETENTION:-30}"

PG_USER="${POSTGRES_USER:-postgres}"
PG_DB="${POSTGRES_DB:-testops}"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

echo "[backup-db] Starting backup of database '${PG_DB}' ..."

# Dump and compress in a single pipeline
docker compose exec -T db pg_dump -U "$PG_USER" "$PG_DB" | gzip > "$BACKUP_FILE"

# Verify the backup is non-empty
FILESIZE=$(stat -f%z "$BACKUP_FILE" 2>/dev/null || stat -c%s "$BACKUP_FILE" 2>/dev/null)
if [ "$FILESIZE" -lt 100 ]; then
  echo "[backup-db] ERROR: Backup file is suspiciously small (${FILESIZE} bytes). Aborting."
  rm -f "$BACKUP_FILE"
  exit 1
fi

echo "[backup-db] Backup written to ${BACKUP_FILE} (${FILESIZE} bytes)"

# Prune old backups beyond retention period
PRUNED=$(find "$BACKUP_DIR" -name 'testops_backup_*.sql.gz' -mtime "+${RETENTION_DAYS}" -print -delete | wc -l | tr -d ' ')
if [ "$PRUNED" -gt 0 ]; then
  echo "[backup-db] Pruned ${PRUNED} backup(s) older than ${RETENTION_DAYS} days"
fi

echo "[backup-db] Done."
