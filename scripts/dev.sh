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

# Start development environment
start_dev() {
  print_step "Starting development environment..."
  
  # Check if services are already running
  if docker-compose ps | grep -q "Up"; then
    print_error "Services are already running. Stop them first with: docker-compose down"
  fi
  
  # Start services
  docker-compose up -d || print_error "Failed to start services"
  print_success "Services started successfully"
  
  # Wait for backend to be ready
  print_step "Waiting for backend to be ready..."
  until curl -s http://localhost:4000/health > /dev/null; do
    sleep 1
  done
  print_success "Backend is ready"
  
  # Start frontend development server
  print_step "Starting frontend development server..."
  cd frontend && npm run dev
}

# Run tests
run_tests() {
  print_step "Running tests..."
  
  print_step "Running backend tests..."
  cd backend && npm test || print_error "Backend tests failed"
  print_success "Backend tests passed"
  
  print_step "Running frontend tests..."
  cd ../frontend && npm test || print_error "Frontend tests failed"
  print_success "Frontend tests passed"
}

# Run linting
run_lint() {
  print_step "Running linting..."
  
  print_step "Linting backend..."
  cd backend && npm run lint || print_error "Backend linting failed"
  print_success "Backend linting passed"
  
  print_step "Linting frontend..."
  cd ../frontend && npm run lint || print_error "Frontend linting failed"
  print_success "Frontend linting passed"
}

# Clean development environment
clean_dev() {
  print_step "Cleaning development environment..."
  
  # Stop services
  docker-compose down || print_error "Failed to stop services"
  
  # Remove node_modules
  rm -rf backend/node_modules frontend/node_modules
  
  # Remove build artifacts
  rm -rf backend/dist frontend/dist
  
  # Remove database files
  rm -rf backend/data/*.sqlite
  
  print_success "Development environment cleaned"
}

# Show help message
show_help() {
  echo "TestOps Copilot Development Script"
  echo
  echo "Usage: ./dev.sh [command]"
  echo
  echo "Commands:"
  echo "  start    Start development environment"
  echo "  test     Run tests"
  echo "  lint     Run linting"
  echo "  clean    Clean development environment"
  echo "  help     Show this help message"
}

# Main function
main() {
  case "$1" in
    "start")
      start_dev
      ;;
    "test")
      run_tests
      ;;
    "lint")
      run_lint
      ;;
    "clean")
      clean_dev
      ;;
    "help"|"")
      show_help
      ;;
    *)
      print_error "Unknown command: $1"
      show_help
      ;;
  esac
}

# Run main function with first argument
main "$1"