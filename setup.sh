#!/bin/bash

echo "Setting up TestOps Companion..."

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "Node.js is required but not installed. Aborting." >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm is required but not installed. Aborting." >&2; exit 1; }

# Optional Docker check
if ! command -v docker >/dev/null 2>&1; then
    echo "Warning: Docker is not installed. You won't be able to use containerized development."
fi

if ! command -v docker-compose >/dev/null 2>&1; then
    echo "Warning: Docker Compose is not installed. You won't be able to use containerized development."
fi

# Create necessary directories
echo "Creating project structure..."
mkdir -p backend/src/{controllers,models,routes,middleware,utils,types,config,database}
mkdir -p backend/logs
mkdir -p backend/tests/{unit,integration,e2e}
mkdir -p frontend/src/{components,pages,hooks,utils,types,contexts,services,assets,styles,config,constants}
mkdir -p frontend/public/{images,icons}
mkdir -p frontend/tests/{unit,integration,e2e}

# Copy environment files
echo "Setting up environment files..."
if [ ! -f backend/.env ]; then
    cp backend/.env.example backend/.env
    echo "Created backend/.env from example"
fi

if [ ! -f frontend/.env ]; then
    cp frontend/.env.example frontend/.env
    echo "Created frontend/.env from example"
fi

# Install dependencies
echo "Installing root dependencies..."
npm install

echo "Installing backend dependencies..."
cd backend
npm install
cd ..

echo "Installing frontend dependencies..."
cd frontend
npm install
cd ..

# Initialize Git repository if not already initialized
if [ ! -d ".git" ]; then
    echo "Initializing Git repository..."
    git init
    git add .
    git commit -m "Initial commit"
fi

# Setup database if using Docker
if command -v docker-compose >/dev/null 2>&1; then
    echo "Setting up database..."
    docker-compose up -d db
    echo "Waiting for database to be ready..."
    sleep 5
    
    echo "Running database migrations..."
    cd backend
    npm run migrate
    
    echo "Seeding database..."
    npm run seed
    cd ..
fi

# Build applications
echo "Building applications..."
npm run build

# Run tests
echo "Running tests..."
npm test

echo "Setup completed successfully!"
echo ""
echo "You can now start the application using:"
echo "  Development mode: npm start"
echo "  Docker mode: docker-compose up"
echo ""
echo "Access the application at:"
echo "  Frontend: http://localhost:5173"
echo "  Backend API: http://localhost:3000"
echo "  API Documentation: http://localhost:3000/api/docs"
echo "  Adminer (Database UI): http://localhost:8080"
echo "  MailHog (Email Testing): http://localhost:8025"
echo ""
echo "For more information, check the README.md file."

# Make script executable
chmod +x setup.sh