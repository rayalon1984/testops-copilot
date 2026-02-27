#!/bin/bash

# Exit on error
set -e

# Print commands
set -x

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Setting up TestOps Copilot development environment...${NC}"

# Check for required tools
command -v docker >/dev/null 2>&1 || { echo "Docker is required but not installed. Aborting." >&2; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "Docker Compose is required but not installed. Aborting." >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Node.js is required but not installed. Aborting." >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm is required but not installed. Aborting." >&2; exit 1; }

# Create necessary directories
mkdir -p frontend/src backend/src

# Copy example environment files
if [ ! -f frontend/.env ]; then
    cp frontend/.env.example frontend/.env
    echo -e "${YELLOW}Created frontend/.env from example${NC}"
fi

if [ ! -f backend/.env ]; then
    cp backend/.env.example backend/.env
    echo -e "${YELLOW}Created backend/.env from example${NC}"
fi

# Install dependencies
echo -e "${GREEN}Installing frontend dependencies...${NC}"
cd frontend
npm install

echo -e "${GREEN}Installing backend dependencies...${NC}"
cd ../backend
npm install

# Build development containers
echo -e "${GREEN}Building Docker containers...${NC}"
cd ..
docker-compose build

# Initialize database
echo -e "${GREEN}Initializing database...${NC}"
docker-compose up -d db
sleep 5  # Wait for database to be ready

# Run database migrations
echo -e "${GREEN}Running database migrations...${NC}"
cd backend
npm run migrate:dev

# Generate TypeScript types
echo -e "${GREEN}Generating TypeScript types...${NC}"
npm run generate:types

# Start development environment
echo -e "${GREEN}Starting development environment...${NC}"
cd ..
docker-compose up -d

# Health check
echo -e "${GREEN}Performing health check...${NC}"
timeout 30s bash -c 'until curl -s http://localhost:3000/health > /dev/null; do sleep 1; done'
timeout 30s bash -c 'until curl -s http://localhost:5173 > /dev/null; do sleep 1; done'

echo -e "${GREEN}Development environment setup complete!${NC}"
echo -e "${GREEN}Frontend: http://localhost:5173${NC}"
echo -e "${GREEN}Backend: http://localhost:3000${NC}"
echo -e "${GREEN}Database UI: http://localhost:8080${NC}"

# Print next steps
echo -e "\n${YELLOW}Next steps:${NC}"
echo "1. Review and update environment variables in frontend/.env and backend/.env"
echo "2. Run 'npm run dev' in the frontend directory to start the development server"
echo "3. Run 'npm run dev' in the backend directory to start the API server"
echo "4. Visit http://localhost:5173 to view the application"
echo -e "\n${YELLOW}For more information, see the documentation at:${NC}"
echo "https://github.com/rayalon1984/testops-companion/blob/main/docs/development.md"