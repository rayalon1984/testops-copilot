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
 * Extract field names from each model in a Prisma schema file.
 * Returns Map<modelName, string[]> where string[] is sorted field names.
 * Strips type annotations and modifiers — only compares field names,
 * because types differ between SQLite (String) and PostgreSQL (enum, @db.Uuid).
 */
function extractModelFields(filePath) {
  if (!fs.existsSync(filePath)) return new Map();
  const content = fs.readFileSync(filePath, 'utf8');

  const models = new Map();
  // Match each model block: model Name { ... }
  const modelRegex = /^model\s+(\w+)\s*\{([^}]+)\}/gm;
  let match;
  while ((match = modelRegex.exec(content)) !== null) {
    const modelName = match[1];
    const body = match[2];
    // Field lines: start with a word that isn't a directive (@@) or comment (//)
    const fields = [];
    for (const line of body.split('\n')) {
      const trimmed = line.trim();
      // Skip blank lines, comments, and block-level directives (@@index, @@unique, @@map)
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) continue;
      // A field line starts with a lowercase or uppercase identifier followed by whitespace and a type
      const fieldMatch = trimmed.match(/^(\w+)\s+/);
      if (fieldMatch) {
        fields.push(fieldMatch[1]);
      }
    }
    models.set(modelName, fields.sort());
  }
  return models;
}

/**
 * Check that production and dev schema files declare the same set of models
 * AND the same fields within each shared model.
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

  // Field-level parity for shared models (warning-only for pre-existing drift,
  // fails CI only for model-level differences — see Sprint 4 postmortem)
  const prodFields = extractModelFields(productionSchema);
  const devFields = extractModelFields(devSchema);
  const sharedModels = prodModels.filter(m => devModels.includes(m));
  let fieldDriftCount = 0;

  for (const model of sharedModels) {
    const pf = prodFields.get(model) || [];
    const df = devFields.get(model) || [];

    const missingInDev = pf.filter(f => !df.includes(f));
    const missingInProd = df.filter(f => !pf.includes(f));

    if (missingInDev.length > 0) {
      log(`⚠️  Model "${model}" — fields in production but MISSING from dev schema:`, colors.yellow);
      missingInDev.forEach(f => log(`     - ${model}.${f}`, colors.yellow));
      fieldDriftCount += missingInDev.length;
    }
    if (missingInProd.length > 0) {
      log(`⚠️  Model "${model}" — fields in dev but MISSING from production schema:`, colors.yellow);
      missingInProd.forEach(f => log(`     - ${model}.${f}`, colors.yellow));
      fieldDriftCount += missingInProd.length;
    }
  }

  if (valid && fieldDriftCount === 0) {
    log(`✅ Model parity OK — ${sharedModels.length} shared models, ${allowlist.size} allowlisted`, colors.green);
    log(`✅ Field parity OK — all shared models have identical field sets`, colors.green);
  } else if (valid) {
    log(`✅ Model parity OK — ${sharedModels.length} shared models, ${allowlist.size} allowlisted`, colors.green);
    log(`⚠️  Field drift detected: ${fieldDriftCount} field(s) differ across schemas (warning, not blocking)`, colors.yellow);
    log(`   Run with --strict-fields to fail on field-level drift`, colors.yellow);
  }

  // If --strict-fields flag is passed, field drift also fails validation
  if (fieldDriftCount > 0 && process.argv.includes('--strict-fields')) {
    log(`❌ --strict-fields: field drift is treated as a failure`, colors.red);
    valid = false;
  }

  return valid;
}

/**
 * Check that key documentation files reference the current version.
 * Prevents docs from drifting behind development.
 */
function checkDocFreshness() {
  log(`\nChecking documentation freshness...`, colors.blue);

  const pkgPath = path.join(__dirname, '../package.json');
  if (!fs.existsSync(pkgPath)) {
    log(`⚠️  Cannot check doc freshness — package.json not found`, colors.yellow);
    return true;
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const version = pkg.version; // e.g. "2.9.0-rc.2"

  // Key docs that should reference the current version
  const docsToCheck = [
    { file: 'CHANGELOG.md', description: 'Changelog' },
    { file: 'specs/ROADMAP.md', description: 'Roadmap' },
  ];

  let valid = true;

  for (const doc of docsToCheck) {
    const filePath = path.join(__dirname, '..', doc.file);
    if (!fs.existsSync(filePath)) {
      log(`⚠️  ${doc.description} not found: ${doc.file}`, colors.yellow);
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes(version)) {
      log(`✅ ${doc.description} references v${version}`, colors.green);
    } else {
      log(`❌ ${doc.description} does NOT reference v${version}`, colors.red);
      log(`   File: ${doc.file}`, colors.red);
      log(`   Action: Update ${doc.file} to include version ${version}`, colors.yellow);
      valid = false;
    }
  }

  if (valid) {
    log(`✅ Documentation freshness OK — all key docs reference v${version}`, colors.green);
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

  // Check documentation freshness
  const docFreshValid = checkDocFreshness();
  allValid = allValid && docFreshValid;

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
