#!/usr/bin/env node

/**
 * Prisma Schema Validation Script
 * Ensures production schema uses PostgreSQL and dev schema uses SQLite
 */

const fs = require('fs');
const path = require('path');

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function validateSchemaFile(filePath, expectedProvider, schemaName) {
  log(`\nChecking ${schemaName}...`, colors.blue);

  if (!fs.existsSync(filePath)) {
    log(`❌ Schema not found: ${filePath}`, colors.red);
    return false;
  }

  const content = fs.readFileSync(filePath, 'utf8');

  // Extract datasource block
  const datasourceMatch = content.match(/datasource\s+db\s*{([^}]+)}/);

  if (!datasourceMatch) {
    log(`❌ No datasource block found in schema`, colors.red);
    return false;
  }

  const datasourceBlock = datasourceMatch[1];

  // Check provider
  const providerMatch = datasourceBlock.match(/provider\s*=\s*"([^"]+)"/);

  if (!providerMatch) {
    log(`❌ No provider specified in datasource`, colors.red);
    return false;
  }

  const actualProvider = providerMatch[1];

  if (actualProvider !== expectedProvider) {
    log(`❌ Wrong provider:`, colors.red);
    log(`   Expected: ${expectedProvider}`, colors.red);
    log(`   Found: ${actualProvider}`, colors.red);
    log(`\n   This is a CRITICAL error!`, colors.red);
    log(`   Production schema MUST use PostgreSQL`, colors.red);
    log(`   Development schema MUST use SQLite`, colors.red);
    return false;
  }

  log(`✅ Provider: ${actualProvider}`, colors.green);

  // Check URL configuration
  const urlMatch = datasourceBlock.match(/url\s*=\s*(.+)/);

  if (!urlMatch) {
    log(`❌ No URL specified in datasource`, colors.red);
    return false;
  }

  const url = urlMatch[1].trim();

  if (expectedProvider === 'postgresql') {
    if (!url.includes('DATABASE_URL') && !url.startsWith('"postgresql://')) {
      log(`⚠️  URL should use env("DATABASE_URL") or postgresql://`, colors.yellow);
    } else {
      log(`✅ URL configured correctly`, colors.green);
    }
  } else if (expectedProvider === 'sqlite') {
    if (!url.includes('file:')) {
      log(`⚠️  URL should use file: for SQLite`, colors.yellow);
    } else {
      log(`✅ URL configured correctly`, colors.green);
    }
  }

  // For PostgreSQL, check for proper types
  if (expectedProvider === 'postgresql') {
    const hasUuidType = content.includes('@db.Uuid');
    const hasEnums = content.includes('enum ');

    if (!hasUuidType) {
      log(`⚠️  No @db.Uuid types found (recommended for PostgreSQL)`, colors.yellow);
    } else {
      log(`✅ Using PostgreSQL UUID types`, colors.green);
    }

    if (!hasEnums) {
      log(`⚠️  No enums found (PostgreSQL supports enums)`, colors.yellow);
    } else {
      log(`✅ Using PostgreSQL enums`, colors.green);
    }
  }

  return true;
}

function checkMigrationsExist() {
  const migrationsDir = path.join(__dirname, '../backend/prisma/migrations');

  log(`\nChecking migrations directory...`, colors.blue);

  if (!fs.existsSync(migrationsDir)) {
    log(`❌ Migrations directory not found`, colors.red);
    log(`   Create it with: mkdir -p backend/prisma/migrations`, colors.yellow);
    return false;
  }

  const migrations = fs.readdirSync(migrationsDir).filter(f =>
    !f.startsWith('.') && fs.statSync(path.join(migrationsDir, f)).isDirectory()
  );

  if (migrations.length === 0) {
    log(`⚠️  No migrations found (this is OK for first setup)`, colors.yellow);
    log(`   Migrations will be created on first db push`, colors.yellow);
  } else {
    log(`✅ Found ${migrations.length} migration(s)`, colors.green);
  }

  return true;
}

function checkSchemaConsistency() {
  log(`\nChecking schema consistency...`, colors.blue);

  const currentSchema = path.join(__dirname, '../backend/prisma/schema.prisma');

  if (!fs.existsSync(currentSchema)) {
    log(`⚠️  No current schema.prisma found`, colors.yellow);
    return true;
  }

  const currentContent = fs.readFileSync(currentSchema, 'utf8');
  const providerMatch = currentContent.match(/provider\s*=\s*"([^"]+)"/);

  if (providerMatch) {
    const currentProvider = providerMatch[1];

    log(`   Current schema.prisma provider: ${currentProvider}`, colors.blue);

    if (currentProvider === 'sqlite') {
      log(`⚠️  WARNING: schema.prisma is using SQLite!`, colors.yellow);
      log(`   For production, copy schema.production.prisma to schema.prisma`, colors.yellow);
      log(`   Command: cp backend/prisma/schema.production.prisma backend/prisma/schema.prisma`, colors.yellow);
    } else {
      log(`✅ Current schema is using ${currentProvider}`, colors.green);
    }
  }

  return true;
}

/**
 * Extract model names from a Prisma schema file.
 */
function extractModelNames(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf8');
  const matches = content.match(/^model\s+(\w+)\s*\{/gm) || [];
  return matches.map(m => m.match(/^model\s+(\w+)/)[1]).sort();
}

/**
 * Check that production and dev schema files declare the same set of models.
 * Intentional differences (e.g. JiraConfig only in dev) can be allowlisted.
 */
function checkModelParity() {
  log(`\nChecking model parity across schemas...`, colors.blue);

  const productionSchema = path.join(__dirname, '../backend/prisma/schema.production.prisma');
  const devSchema = path.join(__dirname, '../backend/prisma/schema.dev.prisma');

  if (!fs.existsSync(productionSchema) || !fs.existsSync(devSchema)) {
    log(`⚠️  Cannot check parity — one or both schema files missing`, colors.yellow);
    return true;
  }

  const prodModels = extractModelNames(productionSchema);
  const devModels = extractModelNames(devSchema);

  // Models that intentionally exist only in one schema
  const allowlist = new Set(['JiraConfig']);

  let valid = true;

  // Check: models in production but not in dev
  const prodOnly = prodModels.filter(m => !devModels.includes(m) && !allowlist.has(m));
  if (prodOnly.length > 0) {
    log(`❌ Models in schema.production.prisma but MISSING from schema.dev.prisma:`, colors.red);
    prodOnly.forEach(m => log(`     - ${m}`, colors.red));
    log(`\n   Fix: Add the missing models to schema.dev.prisma (SQLite version)`, colors.yellow);
    valid = false;
  }

  // Check: models in dev but not in production
  const devOnly = devModels.filter(m => !prodModels.includes(m) && !allowlist.has(m));
  if (devOnly.length > 0) {
    log(`❌ Models in schema.dev.prisma but MISSING from schema.production.prisma:`, colors.red);
    devOnly.forEach(m => log(`     - ${m}`, colors.red));
    log(`\n   Fix: Add the missing models to schema.production.prisma (PostgreSQL version)`, colors.yellow);
    valid = false;
  }

  if (valid) {
    const shared = devModels.filter(m => prodModels.includes(m));
    log(`✅ Model parity OK — ${shared.length} shared models, ${allowlist.size} allowlisted`, colors.green);
  }

  return valid;
}

// Main validation
function main() {
  log('='.repeat(70), colors.blue);
  log('TestOps Companion - Prisma Schema Validation', colors.blue);
  log('='.repeat(70), colors.blue);

  const productionSchema = path.join(__dirname, '../backend/prisma/schema.production.prisma');
  const devSchema = path.join(__dirname, '../backend/prisma/schema.dev.prisma');

  let allValid = true;

  // Validate production schema
  const productionValid = validateSchemaFile(
    productionSchema,
    'postgresql',
    'Production Schema (schema.production.prisma)'
  );
  allValid = allValid && productionValid;

  // Validate dev schema
  const devValid = validateSchemaFile(
    devSchema,
    'sqlite',
    'Development Schema (schema.dev.prisma)'
  );
  allValid = allValid && devValid;

  // Check migrations
  const migrationsExist = checkMigrationsExist();
  allValid = allValid && migrationsExist;

  // Check current schema
  checkSchemaConsistency();

  // Check model parity across schemas
  const parityValid = checkModelParity();
  allValid = allValid && parityValid;

  // Summary
  log('\n' + '='.repeat(70), colors.blue);
  if (allValid) {
    log('✅ All Prisma schemas are valid!', colors.green);
    log('='.repeat(70), colors.blue);
    process.exit(0);
  } else {
    log('❌ Schema validation failed!', colors.red);
    log('\nTo fix:', colors.yellow);
    log('  1. Ensure production schema uses PostgreSQL, dev schema uses SQLite', colors.yellow);
    log('  2. Ensure all models exist in BOTH schema.production.prisma and schema.dev.prisma', colors.yellow);
    log('  3. See model parity errors above for specific missing models', colors.yellow);
    log('='.repeat(70), colors.blue);
    process.exit(1);
  }
}

// Run validation
main();
