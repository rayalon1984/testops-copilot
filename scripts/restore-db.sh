#!/bin/bash
# TestOps Companion - PostgreSQL Restore Script
# Usage: ./scripts/restore-db.sh <backup_file>
# Example: ./scripts/restore-db.sh ./backups/testops_backup_20260105_120000.sql.gz

set -e

BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
  echo "❌ Error: No backup file specified"
  echo "Usage: $0 <backup_file>"
  echo "Example: $0 ./backups/testops_backup_20260105_120000.sql.gz"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Error: Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "⚠️  WARNING: This will REPLACE the current database with the backup!"
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Restore cancelled."
  exit 0
fi

echo "🗄️  Restoring TestOps database from: $BACKUP_FILE"

# Detect compose file being used
COMPOSE_CMD=""
if docker compose ps db &>/dev/null; then
  COMPOSE_CMD="docker compose"
elif docker compose -f docker-compose.prod.yml ps db &>/dev/null; then
  COMPOSE_CMD="docker compose -f docker-compose.prod.yml"
elif docker compose -f docker-compose.ghcr.yml ps db &>/dev/null; then
  COMPOSE_CMD="docker compose -f docker-compose.ghcr.yml"
else
  echo "❌ Error: No running database container found"
  exit 1
fi

# Decompress if needed, then restore
if [[ "$BACKUP_FILE" == *.gz ]]; then
  gunzip -c "$BACKUP_FILE" | $COMPOSE_CMD exec -T db psql -U postgres testops
else
  $COMPOSE_CMD exec -T db psql -U postgres testops < "$BACKUP_FILE"
fi

echo "✅ Database restored successfully!"
