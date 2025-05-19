const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Helper function to generate random string
const generateSecret = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

// Helper function to ensure directory exists
const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Helper function to create .env file if it doesn't exist
const createEnvFile = (templatePath, envPath, replacements) => {
  if (fs.existsSync(envPath)) {
    console.log(`${envPath} already exists, skipping...`);
    return;
  }

  let content = fs.readFileSync(templatePath, 'utf8');
  
  // Replace placeholders with actual values
  Object.entries(replacements).forEach(([key, value]) => {
    content = content.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  });

  fs.writeFileSync(envPath, content);
  console.log(`Created ${envPath}`);
};

// Main setup function
const setup = () => {
  const rootDir = path.resolve(__dirname, '..');
  
  // Ensure required directories exist
  ensureDirectoryExists(path.join(rootDir, 'frontend'));
  ensureDirectoryExists(path.join(rootDir, 'backend'));

  // Generate secrets
  const replacements = {
    JWT_SECRET: generateSecret(),
    REFRESH_TOKEN_SECRET: generateSecret(),  // Used for JWT_REFRESH_SECRET
    SESSION_SECRET: generateSecret(),
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/testops',
    REDIS_URL: 'redis://localhost:6379',
    NODE_ENV: 'development',
    PORT: '3000',
    FRONTEND_URL: 'http://localhost:5173',
    BACKEND_URL: 'http://localhost:3000',
  };

  // Frontend .env
  const frontendEnvTemplate = `
VITE_API_URL={BACKEND_URL}
VITE_WEBSOCKET_URL=ws://localhost:3000
VITE_APP_NAME=TestOps Companion
VITE_ENABLE_NOTIFICATIONS=true
VITE_ENABLE_ANALYTICS=false
VITE_DEFAULT_THEME=light
VITE_DEFAULT_LANGUAGE=en
VITE_ENABLE_DARK_MODE=true
VITE_ENABLE_QUERY_CACHE=true
VITE_CACHE_TTL=300000
`.trim();

  // Backend .env
  const backendEnvTemplate = `
# Server Configuration
NODE_ENV={NODE_ENV}
PORT={PORT}
FRONTEND_URL={FRONTEND_URL}

# Database Configuration
DATABASE_URL={DATABASE_URL}
REDIS_URL={REDIS_URL}

# Authentication
JWT_SECRET={JWT_SECRET}
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET={REFRESH_TOKEN_SECRET}
JWT_REFRESH_EXPIRES_IN=7d
SESSION_SECRET={SESSION_SECRET}

# Logging
LOG_LEVEL=debug
ENABLE_REQUEST_LOGGING=true
ENABLE_RESPONSE_LOGGING=true

# Cache Configuration
CACHE_TTL=300
ENABLE_RESPONSE_CACHE=true

# Rate Limiting
RATE_LIMIT_WINDOW=15m
RATE_LIMIT_MAX_REQUESTS=100

# Security
BCRYPT_SALT_ROUNDS=10
ENABLE_2FA=false
PASSWORD_RESET_TOKEN_EXPIRY=1h
ALLOWED_DOMAINS=*
`.trim();

  // Create temporary template files
  const frontendTemplatePath = path.join(rootDir, 'frontend', '.env.template');
  const backendTemplatePath = path.join(rootDir, 'backend', '.env.template');

  fs.writeFileSync(frontendTemplatePath, frontendEnvTemplate);
  fs.writeFileSync(backendTemplatePath, backendEnvTemplate);

  // Create actual .env files
  createEnvFile(
    frontendTemplatePath,
    path.join(rootDir, 'frontend', '.env'),
    replacements
  );
  createEnvFile(
    backendTemplatePath,
    path.join(rootDir, 'backend', '.env'),
    replacements
  );

  // Clean up template files
  fs.unlinkSync(frontendTemplatePath);
  fs.unlinkSync(backendTemplatePath);

  console.log('Environment setup completed successfully!');
};

// Run setup
try {
  setup();
} catch (error) {
  console.error('Error during environment setup:', error);
  process.exit(1);
}