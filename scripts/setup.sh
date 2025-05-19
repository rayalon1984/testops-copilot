#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Print step with color
print_step() {
  echo -e "${YELLOW}==>${NC} $1"
}

# Print success message
print_success() {
  echo -e "${GREEN}✓${NC} $1"
}

# Print error message and exit
print_error() {
  echo -e "${RED}✗${NC} $1"
  exit 1
}

# Check if required tools are installed
check_requirements() {
  print_step "Checking requirements..."
  
  command -v node >/dev/null 2>&1 || {
    print_error "Node.js is required but not installed. Please install Node.js 18 or later."
  }
  
  command -v npm >/dev/null 2>&1 || {
    print_error "npm is required but not installed."
  }
  
  command -v docker >/dev/null 2>&1 || {
    print_error "Docker is required but not installed."
  }
  
  command -v docker-compose >/dev/null 2>&1 || {
    print_error "Docker Compose is required but not installed."
  }
  
  print_success "All requirements satisfied"
}

# Install dependencies
install_dependencies() {
  print_step "Installing backend dependencies..."
  cd backend && npm install || print_error "Failed to install backend dependencies"
  print_success "Backend dependencies installed"
  
  print_step "Installing frontend dependencies..."
  cd ../frontend && npm install || print_error "Failed to install frontend dependencies"
  print_success "Frontend dependencies installed"
  
  cd ..
}

# Set up environment files
setup_env() {
  print_step "Setting up environment files..."
  
  if [ ! -f backend/.env ]; then
    cp backend/.env.example backend/.env || print_error "Failed to create backend .env file"
    print_success "Created backend .env file"
  else
    print_success "Backend .env file already exists"
  fi
  
  if [ ! -f frontend/.env ]; then
    cp frontend/.env.example frontend/.env || print_error "Failed to create frontend .env file"
    print_success "Created frontend .env file"
  else
    print_success "Frontend .env file already exists"
  fi
}

# Initialize database
init_database() {
  print_step "Initializing database..."
  
  cd backend
  mkdir -p data
  npm run db:migrate || print_error "Failed to run database migrations"
  npm run db:seed || print_error "Failed to seed database"
  print_success "Database initialized"
  cd ..
}

# Build Docker images
build_docker() {
  print_step "Building Docker images..."
  docker-compose build || print_error "Failed to build Docker images"
  print_success "Docker images built successfully"
}

# Main setup process
main() {
  echo "🚀 Setting up TestOps Companion..."
  echo
  
  check_requirements
  install_dependencies
  setup_env
  init_database
  build_docker
  
  echo
  echo -e "${GREEN}✨ Setup completed successfully!${NC}"
  echo
  echo "To start the development environment:"
  echo "1. Start the services: docker-compose up -d"
  echo "2. Frontend will be available at: http://localhost:3000"
  echo "3. Backend API will be available at: http://localhost:4000"
  echo
  echo "For more information, check the README.md file"
}

# Run main function
main