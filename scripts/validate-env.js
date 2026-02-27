#!/usr/bin/env node

/**
 * Environment Validation Script
 * Validates .env files for required variables and correct formats
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

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

function checkEnvFile(filePath, requiredVars, optionalVars = []) {
  log(`\nChecking ${filePath}...`, colors.blue);

  if (!fs.existsSync(filePath)) {
    log(`❌ File not found: ${filePath}`, colors.red);
    return false;
  }

  // Parse .env file
  const envConfig = dotenv.parse(fs.readFileSync(filePath));

  let hasErrors = false;
  let hasWarnings = false;

  // Check required variables
  log('\n  Required variables:', colors.blue);
  for (const [key, validator] of Object.entries(requiredVars)) {
    const value = envConfig[key];

    if (!value || value.trim() === '') {
      log(`  ❌ ${key}: Missing or empty`, colors.red);
      hasErrors = true;
    } else {
      const validation = validator(value);
      if (validation.valid) {
        log(`  ✅ ${key}: ${validation.message || 'OK'}`, colors.green);
      } else {
        log(`  ❌ ${key}: ${validation.message}`, colors.red);
        hasErrors = true;
      }
    }
  }

  // Check optional variables
  if (optionalVars.length > 0) {
    log('\n  Optional variables:', colors.blue);
    for (const [key, validator] of Object.entries(optionalVars)) {
      const value = envConfig[key];

      if (!value || value.trim() === '') {
        log(`  ⚠️  ${key}: Not configured (optional)`, colors.yellow);
        hasWarnings = true;
      } else {
        const validation = validator(value);
        if (validation.valid) {
          log(`  ✅ ${key}: ${validation.message || 'OK'}`, colors.green);
        } else {
          log(`  ⚠️  ${key}: ${validation.message}`, colors.yellow);
          hasWarnings = true;
        }
      }
    }
  }

  return !hasErrors;
}

// Validators
const validators = {
  port: (value) => {
    const port = parseInt(value, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      return { valid: false, message: 'Must be a number between 1 and 65535' };
    }
    return { valid: true, message: `Port ${port}` };
  },

  url: (value) => {
    try {
      new URL(value);
      return { valid: true };
    } catch {
      return { valid: false, message: 'Must be a valid URL' };
    }
  },

  databaseUrl: (value) => {
    if (!value.startsWith('postgresql://') && !value.startsWith('file:')) {
      return { valid: false, message: 'Must start with postgresql:// or file:' };
    }
    return { valid: true, message: value.startsWith('postgresql://') ? 'PostgreSQL' : 'SQLite' };
  },

  secret: (value) => {
    if (value.length < 32) {
      return { valid: false, message: 'Should be at least 32 characters for security' };
    }
    if (value.includes('your-') || value.includes('change-this')) {
      return { valid: false, message: 'Using default insecure value' };
    }
    return { valid: true, message: `${value.length} characters` };
  },

  nodeEnv: (value) => {
    const valid = ['development', 'production', 'test'].includes(value);
    return {
      valid,
      message: valid ? value : 'Should be development, production, or test'
    };
  },

  corsOrigin: (value) => {
    if (value === '*') {
      return { valid: true, message: 'Allowing all origins (not recommended for production)' };
    }
    try {
      new URL(value);
      return { valid: true };
    } catch {
      return { valid: false, message: 'Must be a valid URL or *' };
    }
  },

  boolean: (value) => {
    const valid = ['true', 'false'].includes(value.toLowerCase());
    return {
      valid,
      message: valid ? value : 'Should be true or false'
    };
  },

  aiProvider: (value) => {
    const valid = ['anthropic', 'openai', 'google', 'azure'].includes(value);
    return {
      valid,
      message: valid ? value : 'Should be anthropic, openai, google, or azure'
    };
  },

  notEmpty: (value) => {
    return { valid: value.trim().length > 0 };
  }
};

// Backend required variables
const backendRequired = {
  NODE_ENV: validators.nodeEnv,
  PORT: validators.port,
  DATABASE_URL: validators.databaseUrl,
  JWT_SECRET: validators.secret,
  JWT_REFRESH_SECRET: validators.secret,
  CORS_ORIGIN: validators.corsOrigin
};

// Backend optional variables
const backendOptional = {
  REDIS_URL: validators.url,
  AI_ENABLED: validators.boolean,
  AI_PROVIDER: validators.aiProvider,
  ANTHROPIC_API_KEY: validators.notEmpty,
  OPENAI_API_KEY: validators.notEmpty,
  GOOGLE_API_KEY: validators.notEmpty,
  WEAVIATE_URL: validators.url,
  JIRA_BASE_URL: validators.url,
  SLACK_WEBHOOK_URL: validators.url
};

// Frontend required variables
const frontendRequired = {
  VITE_API_URL: validators.url,
  VITE_WEBSOCKET_URL: (value) => {
    if (!value.startsWith('ws://') && !value.startsWith('wss://')) {
      return { valid: false, message: 'Must start with ws:// or wss://' };
    }
    return { valid: true };
  }
};

// Frontend optional variables
const frontendOptional = {
  VITE_ENABLE_NOTIFICATIONS: validators.boolean,
  VITE_ENABLE_DARK_MODE: validators.boolean
};

// Main validation
function main() {
  log('='.repeat(60), colors.blue);
  log('TestOps Copilot - Environment Validation', colors.blue);
  log('='.repeat(60), colors.blue);

  const backendEnvPath = path.join(__dirname, '../backend/.env');
  const frontendEnvPath = path.join(__dirname, '../frontend/.env');

  let allValid = true;

  // Validate backend .env
  if (fs.existsSync(backendEnvPath)) {
    const backendValid = checkEnvFile(backendEnvPath, backendRequired, backendOptional);
    allValid = allValid && backendValid;
  } else {
    log(`\n⚠️  Backend .env not found at ${backendEnvPath}`, colors.yellow);
    log('   Run: bash scripts/setup-validated.sh', colors.yellow);
    allValid = false;
  }

  // Validate frontend .env
  if (fs.existsSync(frontendEnvPath)) {
    const frontendValid = checkEnvFile(frontendEnvPath, frontendRequired, frontendOptional);
    allValid = allValid && frontendValid;
  } else {
    log(`\n⚠️  Frontend .env not found at ${frontendEnvPath}`, colors.yellow);
    log('   Run: bash scripts/setup-validated.sh', colors.yellow);
    allValid = false;
  }

  // Summary
  log('\n' + '='.repeat(60), colors.blue);
  if (allValid) {
    log('✅ All environment variables are valid!', colors.green);
    log('='.repeat(60), colors.blue);
    process.exit(0);
  } else {
    log('❌ Environment validation failed!', colors.red);
    log('\nTo fix:', colors.yellow);
    log('  1. Run: bash scripts/setup-validated.sh', colors.yellow);
    log('  2. Or manually update the .env files', colors.yellow);
    log('='.repeat(60), colors.blue);
    process.exit(1);
  }
}

// Run validation
main();
