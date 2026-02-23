#!/bin/bash
# validate-migrations.sh — CI check that every Prisma migration has a rollback.sql
#
# Usage: ./scripts/validate-migrations.sh
# Exit code: 0 if all migrations have rollback.sql, 1 otherwise

set -euo pipefail

MIGRATIONS_DIR="backend/prisma/migrations"
EXIT_CODE=0

for dir in "$MIGRATIONS_DIR"/*/; do
  # Skip .gitkeep and non-directories
  [ -d "$dir" ] || continue

  migration_name=$(basename "$dir")

  # Skip the migration_lock.toml (not a directory, but guard anyway)
  [ "$migration_name" = "migration_lock.toml" ] && continue

  if [ ! -f "$dir/migration.sql" ]; then
    continue  # Not a real migration directory
  fi

  if [ ! -f "$dir/rollback.sql" ]; then
    echo "ERROR: Missing rollback.sql in $dir"
    EXIT_CODE=1
  else
    echo "OK: $migration_name has rollback.sql"
  fi
done

if [ "$EXIT_CODE" -eq 0 ]; then
  echo ""
  echo "All migrations have rollback scripts."
else
  echo ""
  echo "FAILED: Some migrations are missing rollback.sql files."
  echo "See docs/project/CONTRIBUTING.md for the migration workflow."
fi

exit $EXIT_CODE
