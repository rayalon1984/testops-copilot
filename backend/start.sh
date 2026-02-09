#!/bin/sh
set -e

echo "Waiting for database to be ready..."
# Simple wait loop for database connectivity
MAX_RETRIES=30
RETRY_COUNT=0
until node -e "
  const { PrismaClient } = require('@prisma/client');
  const p = new PrismaClient();
  p.\$connect().then(() => { p.\$disconnect(); process.exit(0); }).catch(() => process.exit(1));
" 2>/dev/null; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ "$RETRY_COUNT" -ge "$MAX_RETRIES" ]; then
    echo "ERROR: Database not ready after ${MAX_RETRIES} retries"
    exit 1
  fi
  echo "Database not ready yet (attempt $RETRY_COUNT/$MAX_RETRIES)..."
  sleep 2
done
echo "Database is ready."

echo "Running database migrations..."
prisma migrate deploy || npx prisma@5 migrate deploy

echo "Starting application..."
node dist/index.js
