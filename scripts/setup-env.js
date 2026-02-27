#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Paths to environment files
const backendEnvPath = path.join(__dirname, '../backend/.env');
const backendEnvExamplePath = path.join(__dirname, '../backend/.env.example');
const frontendEnvPath = path.join(__dirname, '../frontend/.env');
const frontendEnvExamplePath = path.join(__dirname, '../frontend/.env.example');

// Ensure scripts directory exists
if (!fs.existsSync(__dirname)) {
  fs.mkdirSync(__dirname, { recursive: true });
}

// Function to prompt user for input with a default value
function prompt(question, defaultValue) {
  return new Promise((resolve) => {
    rl.question(`${question} (${defaultValue}): `, (answer) => {
      resolve(answer || defaultValue);
    });
  });
}

// Function to generate a random string for secrets
function generateRandomString(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Function to create environment file from example
async function setupEnvFile(examplePath, envPath, additionalSetup) {
  console.log(`Setting up ${envPath}...`);

  if (!fs.existsSync(examplePath)) {
    console.error(`Example file not found: ${examplePath}`);
    return false;
  }

  // Read example file
  let envContent = fs.readFileSync(examplePath, 'utf8');

  // Apply additional setup if provided
  if (additionalSetup) {
    envContent = await additionalSetup(envContent);
  }

  // Write to env file
  fs.writeFileSync(envPath, envContent);
  console.log(`Created ${envPath}`);
  return true;
}

// Setup backend environment
async function setupBackendEnv(envContent) {
  // Generate secure secrets for JWT
  envContent = envContent.replace(
    'JWT_SECRET=your-super-secret-jwt-key',
    `JWT_SECRET=${generateRandomString(64)}`
  );
  envContent = envContent.replace(
    'JWT_REFRESH_SECRET=your-super-secret-refresh-token-key',
    `JWT_REFRESH_SECRET=${generateRandomString(64)}`
  );
  envContent = envContent.replace(
    'SESSION_SECRET=your-super-secret-session-key',
    `SESSION_SECRET=${generateRandomString(64)}`
  );

  // Ask for GitHub token
  const githubToken = await prompt('Enter your GitHub token (leave empty to skip)', '');
  if (githubToken) {
    envContent = envContent.replace('GITHUB_TOKEN=', `GITHUB_TOKEN=${githubToken}`);
  }

  // Ask for Jira token
  const jiraToken = await prompt('Enter your Jira API token (leave empty to skip)', '');
  if (jiraToken) {
    envContent = envContent.replace(
      'JIRA_API_TOKEN=your-api-token',
      `JIRA_API_TOKEN=${jiraToken}`
    );

    // Ask for Jira base URL
    const jiraBaseUrl = await prompt('Enter your Jira base URL', 'https://your-domain.atlassian.net');
    envContent = envContent.replace(
      'JIRA_BASE_URL=https://your-domain.atlassian.net',
      `JIRA_BASE_URL=${jiraBaseUrl}`
    );

    // Ask for Jira project key
    const jiraProjectKey = await prompt('Enter your Jira project key', 'PROJ');
    envContent = envContent.replace('JIRA_PROJECT_KEY=PROJ', `JIRA_PROJECT_KEY=${jiraProjectKey}`);
  }

  return envContent;
}

// Setup frontend environment
async function setupFrontendEnv(envContent) {
  // Frontend uses Vite env vars (VITE_ prefix), no changes needed from template
  // VITE_API_URL defaults to http://localhost:3000 which matches the backend default
  return envContent;
}

// Main setup function
async function setup() {
  console.log('Setting up TestOps Copilot environment...');
  
  // Create directories if they don't exist
  const dirs = [
    path.join(__dirname, '../backend'),
    path.join(__dirname, '../frontend')
  ];
  
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // Setup backend environment
  const backendSetup = await setupEnvFile(backendEnvExamplePath, backendEnvPath, setupBackendEnv);
  
  // Setup frontend environment
  const frontendSetup = await setupEnvFile(frontendEnvExamplePath, frontendEnvPath, setupFrontendEnv);
  
  if (backendSetup && frontendSetup) {
    console.log('Environment setup completed successfully!');
  } else {
    console.error('Environment setup failed. Please check the error messages above.');
  }
  
  rl.close();
}

// Run setup
setup().catch(err => {
  console.error('Error during setup:', err);
  rl.close();
  process.exit(1);
});