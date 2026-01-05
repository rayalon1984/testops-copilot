#!/bin/bash
# TestOps Companion - PostgreSQL Backup Script
# Usage: ./scripts/backup-db.sh [output_path]
# Example: ./scripts/backup-db.sh ./backups/

set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_DIR="${1:-./backups}"
BACKUP_FILE="${OUTPUT_DIR}/testops_backup_${TIMESTAMP}.sql"

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

echo "🗄️  Backing up TestOps database..."

# Check if running via docker compose
if docker compose ps db &>/dev/null; then
  docker compose exec -T db pg_dump -U postgres testops > "$BACKUP_FILE"
elif docker compose -f docker-compose.prod.yml ps db &>/dev/null; then
  docker compose -f docker-compose.prod.yml exec -T db pg_dump -U postgres testops > "$BACKUP_FILE"
elif docker compose -f docker-compose.ghcr.yml ps db &>/dev/null; then
  docker compose -f docker-compose.ghcr.yml exec -T db pg_dump -U postgres testops > "$BACKUP_FILE"
else
  echo "❌ Error: No running database container found"
  echo "   Make sure docker compose is running with one of:"
  echo "   - docker compose up -d"
  echo "   - docker compose -f docker-compose.prod.yml up -d"
  echo "   - docker compose -f docker-compose.ghcr.yml up -d"
  exit 1
fi

# Compress the backup
gzip "$BACKUP_FILE"
BACKUP_FILE="${BACKUP_FILE}.gz"

echo "✅ Backup created: $BACKUP_FILE"
echo "   Size: $(du -h "$BACKUP_FILE" | cut -f1)"
