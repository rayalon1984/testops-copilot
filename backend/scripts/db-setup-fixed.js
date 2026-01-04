#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from backend directory
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

// Function to execute commands and handle errors
function runCommand(command, errorMessage, options = {}) {
  try {
    console.log(`Running: ${command}`);
    execSync(command, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
      ...options
    });
    return true;
  } catch (error) {
    console.error(`${errorMessage}: ${error.message}`);
    return false;
  }
}

// Function to check if database exists
function checkDatabaseExists(dbUrl) {
  try {
    const url = new URL(dbUrl);
    const dbName = url.pathname.substring(1);

    // Create connection URL for postgres database
    url.pathname = '/postgres';
    const baseUrl = url.toString();

    // Use psql to check if database exists
    const checkCmd = `PGPASSWORD='${url.password}' psql -h ${url.hostname} -p ${url.port || 5432} -U ${url.username} -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${dbName}'"`;

    const result = execSync(checkCmd, { encoding: 'utf8', stdio: 'pipe' });
    return result.trim() === '1';
  } catch (error) {
    console.warn('Could not check database existence:', error.message);
    return false;
  }
}

// Function to create database if it doesn't exist
function createDatabase(dbUrl) {
  try {
    const url = new URL(dbUrl);
    const dbName = url.pathname.substring(1);

    console.log(`Creating database '${dbName}' if it doesn't exist...`);

    // PostgreSQL command to create database
    const createCmd = `PGPASSWORD='${url.password}' psql -h ${url.hostname} -p ${url.port || 5432} -U ${url.username} -d postgres -c "CREATE DATABASE \\"${dbName}\\""`;

    execSync(createCmd, { stdio: 'pipe' });
    console.log(`✅ Database '${dbName}' created successfully`);
    return true;
  } catch (error) {
    // Database might already exist, which is fine
    if (error.message.includes('already exists')) {
      console.log(`Database already exists, continuing...`);
      return true;
    }
    console.warn('Could not create database:', error.message);
    return false;
  }
}

// Main function to set up the database
async function setupDatabase() {
  console.log('🗄️  Setting up database...\n');

  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set in the .env file');
    console.error('Please create a .env file in the backend directory with DATABASE_URL');
    process.exit(1);
  }

  console.log(`Using database: ${process.env.DATABASE_URL.replace(/:([^:@]+)@/, ':****@')}\n`);

  // Try to create database if it doesn't exist
  try {
    const dbExists = checkDatabaseExists(process.env.DATABASE_URL);
    if (!dbExists) {
      createDatabase(process.env.DATABASE_URL);
    } else {
      console.log('✅ Database already exists\n');
    }
  } catch (error) {
    console.warn('⚠️  Could not check/create database, will proceed anyway\n');
  }

  // Generate Prisma client
  console.log('📦 Generating Prisma client...');
  if (!runCommand('npx prisma generate', 'Failed to generate Prisma client')) {
    process.exit(1);
  }
  console.log('✅ Prisma client generated\n');

  // Check if migrations exist
  const migrationsDir = path.join(__dirname, '../prisma/migrations');
  const hasMigrations = fs.existsSync(migrationsDir) &&
                        fs.readdirSync(migrationsDir).length > 0;

  if (hasMigrations) {
    // Run migrations
    console.log('🔄 Running database migrations...');
    if (!runCommand('npx prisma migrate deploy', 'Failed to run migrations')) {
      console.error('❌ Migration failed. You may need to reset the database.');
      console.error('   Run: npx prisma migrate reset (WARNING: This will delete all data)');
      process.exit(1);
    }
    console.log('✅ Migrations completed\n');
  } else {
    // No migrations, use db push for dev
    console.log('⚠️  No migrations found, using db push...');
    if (!runCommand('npx prisma db push', 'Failed to push schema')) {
      process.exit(1);
    }
    console.log('✅ Schema pushed\n');
  }

  // Seed the database if seed file exists
  const seedPath = path.join(__dirname, '../prisma/seed.ts');
  if (fs.existsSync(seedPath)) {
    console.log('🌱 Seeding database...');
    if (!runCommand('npx prisma db seed', 'Failed to seed database')) {
      console.warn('⚠️  Seeding failed, but database is set up');
    } else {
      console.log('✅ Database seeded\n');
    }
  } else {
    console.log('ℹ️  No seed file found, skipping database seeding\n');
  }

  console.log('========================================');
  console.log('✅ Database setup completed successfully!');
  console.log('========================================\n');
}

// Run the setup
setupDatabase().catch(error => {
  console.error('❌ Database setup failed:', error.message);
  process.exit(1);
});
