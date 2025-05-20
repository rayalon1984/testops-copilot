#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Function to execute commands and handle errors
function runCommand(command, errorMessage) {
  try {
    console.log(`Running: ${command}`);
    execSync(command, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    return true;
  } catch (error) {
    console.error(`${errorMessage}: ${error.message}`);
    return false;
  }
}

// Main function to set up the database
async function setupDatabase() {
  console.log('Setting up database...');

  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set in the .env file');
    process.exit(1);
  }

  // Generate Prisma client
  if (!runCommand('npx prisma generate', 'Failed to generate Prisma client')) {
    process.exit(1);
  }

  // Create database if it doesn't exist
  try {
    // Extract database name from DATABASE_URL
    const dbUrl = new URL(process.env.DATABASE_URL);
    const dbName = dbUrl.pathname.substring(1); // Remove leading slash
    
    // Create a connection URL without the database name
    const baseUrl = `${dbUrl.protocol}//${dbUrl.username}:${dbUrl.password}@${dbUrl.host}`;
    
    // Create database if it doesn't exist
    const createDbCommand = `npx prisma db execute --url="${baseUrl}" --stdin < ${path.join(__dirname, 'create-db.sql')}`;
    
    // Create the SQL file with CREATE DATABASE command
    fs.writeFileSync(
      path.join(__dirname, 'create-db.sql'),
      `CREATE DATABASE IF NOT EXISTS "${dbName}";`
    );
    
    runCommand(createDbCommand, 'Failed to create database');
    
    // Clean up
    fs.unlinkSync(path.join(__dirname, 'create-db.sql'));
  } catch (error) {
    console.warn('Could not automatically create database, will try to run migrations anyway:', error.message);
  }

  // Run migrations
  if (!runCommand('npx prisma migrate deploy', 'Failed to run migrations')) {
    process.exit(1);
  }

  // Seed the database if seed file exists
  const seedPath = path.join(__dirname, '../prisma/seed.ts');
  if (fs.existsSync(seedPath)) {
    if (!runCommand('npx prisma db seed', 'Failed to seed database')) {
      process.exit(1);
    }
  } else {
    console.log('No seed file found, skipping database seeding');
  }

  console.log('Database setup completed successfully!');
}

// Run the setup
setupDatabase().catch(error => {
  console.error('Database setup failed:', error);
  process.exit(1);
});