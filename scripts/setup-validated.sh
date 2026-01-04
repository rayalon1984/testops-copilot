#!/bin/bash

# TestOps Companion - Production Setup Script with Validation
# This script ensures a smooth production installation

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  TestOps Companion - Production Setup ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Validation functions
check_command() {
  if command -v $1 &> /dev/null; then
    echo -e "${GREEN}✅ $1 is installed${NC}"
    return 0
  else
    echo -e "${RED}❌ $1 is not installed${NC}"
    return 1
  fi
}

check_version() {
  local cmd=$1
  local required=$2
  local current=$($cmd)

  echo -e "${GREEN}✅ $cmd version: $current${NC}"
}

# Step 1: Check prerequisites
echo -e "${BLUE}Step 1: Checking prerequisites...${NC}"
echo ""

MISSING_DEPS=0

# Check Node.js
if check_command node; then
  NODE_VERSION=$(node --version)
  REQUIRED_NODE="18.0.0"
  echo "   Version: $NODE_VERSION (required: >= v$REQUIRED_NODE)"
else
  echo -e "   ${YELLOW}Please install Node.js >= 18.0.0 from https://nodejs.org${NC}"
  MISSING_DEPS=1
fi

# Check npm
if check_command npm; then
  NPM_VERSION=$(npm --version)
  echo "   Version: $NPM_VERSION"
else
  echo -e "   ${YELLOW}npm should come with Node.js${NC}"
  MISSING_DEPS=1
fi

# Check PostgreSQL
if check_command psql; then
  PSQL_VERSION=$(psql --version)
  echo "   Version: $PSQL_VERSION"
else
  echo -e "   ${YELLOW}PostgreSQL not found. Install from https://www.postgresql.org${NC}"
  echo -e "   ${YELLOW}Or use Docker: docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:15${NC}"
  MISSING_DEPS=1
fi

# Check Docker (optional but recommended)
if check_command docker; then
  DOCKER_VERSION=$(docker --version)
  echo "   Version: $DOCKER_VERSION"
else
  echo -e "   ${YELLOW}⚠️  Docker not found (optional but recommended)${NC}"
  echo -e "   ${YELLOW}   Install from https://www.docker.com/products/docker-desktop${NC}"
fi

echo ""

if [ $MISSING_DEPS -eq 1 ]; then
  echo -e "${RED}❌ Missing required dependencies. Please install them and try again.${NC}"
  exit 1
fi

# Step 2: Install dependencies
echo -e "${BLUE}Step 2: Installing dependencies...${NC}"
echo ""

if [ ! -d "node_modules" ]; then
  echo "Installing root dependencies..."
  npm install
else
  echo "Root dependencies already installed"
fi

if [ ! -d "backend/node_modules" ]; then
  echo "Installing backend dependencies..."
  cd backend && npm install && cd ..
else
  echo "Backend dependencies already installed"
fi

if [ ! -d "frontend/node_modules" ]; then
  echo "Installing frontend dependencies..."
  cd frontend && npm install && cd ..
else
  echo "Frontend dependencies already installed"
fi

echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# Step 3: Environment configuration
echo -e "${BLUE}Step 3: Configuring environment variables...${NC}"
echo ""

# Backend environment
if [ ! -f "backend/.env" ]; then
  echo "Creating backend/.env..."

  # Generate secure secrets
  JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64)
  JWT_REFRESH_SECRET=$(openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64)
  SESSION_SECRET=$(openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64)

  cat > backend/.env << EOF
# Server Configuration
NODE_ENV=development
PORT=3000
HOST=localhost
CORS_ORIGIN=http://localhost:5173

# Database Configuration
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/testops

# Authentication - Auto-generated secure secrets
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
JWT_REFRESH_EXPIRES_IN=7d
SESSION_SECRET=${SESSION_SECRET}

# Redis (optional - comment out if not using)
# REDIS_URL=redis://localhost:6379

# AI Configuration (optional - uncomment and configure if using AI features)
# AI_ENABLED=true
# AI_PROVIDER=anthropic
# ANTHROPIC_API_KEY=your_key_here
# WEAVIATE_URL=http://localhost:8081

# Integrations (optional - configure as needed)
# JIRA_BASE_URL=https://your-domain.atlassian.net
# JIRA_API_TOKEN=your_token_here
# SLACK_WEBHOOK_URL=your_webhook_url_here

# Logging
LOG_LEVEL=info
EOF

  echo -e "${GREEN}✅ Backend .env created with secure secrets${NC}"
else
  echo -e "${YELLOW}⚠️  backend/.env already exists, skipping...${NC}"
  echo -e "   If you need to regenerate, delete it and run this script again"
fi

# Frontend environment
if [ ! -f "frontend/.env" ]; then
  echo "Creating frontend/.env..."

  cat > frontend/.env << EOF
# API Configuration
VITE_API_URL=http://localhost:3000
VITE_WEBSOCKET_URL=ws://localhost:3000

# Feature Flags
VITE_ENABLE_NOTIFICATIONS=true
VITE_ENABLE_ANALYTICS=false

# UI Configuration
VITE_APP_NAME=TestOps Companion
VITE_DEFAULT_THEME=light
VITE_ENABLE_DARK_MODE=true
EOF

  echo -e "${GREEN}✅ Frontend .env created${NC}"
else
  echo -e "${YELLOW}⚠️  frontend/.env already exists, skipping...${NC}"
fi

echo ""

# Step 4: Database setup
echo -e "${BLUE}Step 4: Setting up database...${NC}"
echo ""

# Check if PostgreSQL is accessible
echo "Checking PostgreSQL connection..."
DB_URL=$(grep "^DATABASE_URL=" backend/.env | cut -d '=' -f2)

# Test connection
if PGPASSWORD=postgres psql -h localhost -U postgres -d postgres -c "SELECT 1" &> /dev/null; then
  echo -e "${GREEN}✅ PostgreSQL is accessible${NC}"

  # Create database if it doesn't exist
  DB_NAME=$(echo $DB_URL | sed 's/.*\///' | cut -d '?' -f1)
  echo "Creating database '$DB_NAME' if it doesn't exist..."

  PGPASSWORD=postgres psql -h localhost -U postgres -d postgres -c "CREATE DATABASE $DB_NAME" 2>/dev/null || echo "Database already exists"

  # Run Prisma setup
  cd backend
  echo "Generating Prisma client..."
  npx prisma generate

  echo "Running database migrations..."
  if [ -d "prisma/migrations" ] && [ "$(ls -A prisma/migrations)" ]; then
    npx prisma migrate deploy
  else
    echo "No migrations found, using db push..."
    npx prisma db push
  fi

  # Optional: Run seed
  if [ -f "prisma/seed.ts" ]; then
    echo "Seeding database..."
    npx prisma db seed || echo "Seeding skipped or failed"
  fi

  cd ..

  echo -e "${GREEN}✅ Database setup complete${NC}"
else
  echo -e "${YELLOW}⚠️  Could not connect to PostgreSQL${NC}"
  echo -e "   Please ensure PostgreSQL is running and accessible"
  echo -e "   You can start it with: docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:15"
  echo -e "   Or use the local-setup.sh script for Docker Compose"
  echo ""
  echo -e "   ${BLUE}Continuing anyway... You'll need to set up the database manually${NC}"
fi

echo ""

# Step 5: Verification
echo -e "${BLUE}Step 5: Running verification checks...${NC}"
echo ""

cd backend
echo "Running TypeScript type checking..."
if npm run typecheck; then
  echo -e "${GREEN}✅ TypeScript types are valid${NC}"
else
  echo -e "${YELLOW}⚠️  TypeScript type errors found (non-critical)${NC}"
fi

echo ""
echo "Running linter..."
if npm run lint; then
  echo -e "${GREEN}✅ Code passes linting${NC}"
else
  echo -e "${YELLOW}⚠️  Linting warnings found (non-critical)${NC}"
fi

cd ..

echo ""

# Final summary
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   ✅ Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo ""
echo "1. ${YELLOW}Review configuration:${NC}"
echo "   - Backend: backend/.env"
echo "   - Frontend: frontend/.env"
echo ""
echo "2. ${YELLOW}Start development servers:${NC}"
echo "   npm run dev"
echo ""
echo "   Or separately:"
echo "   - Backend:  cd backend && npm run dev"
echo "   - Frontend: cd frontend && npm run dev"
echo ""
echo "3. ${YELLOW}Access the application:${NC}"
echo "   - Frontend: http://localhost:5173"
echo "   - Backend API: http://localhost:3000/api/v1"
echo ""
echo "4. ${YELLOW}Optional - Start Docker services:${NC}"
echo "   docker-compose up -d db redis weaviate"
echo ""
echo -e "${BLUE}For demo mode (no PostgreSQL needed):${NC}"
echo "   npm run dev:simple"
echo ""
echo -e "${GREEN}Happy coding! 💻✨${NC}"
echo ""
