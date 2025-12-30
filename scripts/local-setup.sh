#!/bin/bash

# TestOps Companion - Local Development Setup Script
# This script sets up everything you need to run locally on Mac

set -e

echo "🚀 TestOps Companion - Local Setup"
echo "===================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    echo "Please install Docker Desktop from: https://www.docker.com/products/docker-desktop"
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo -e "${YELLOW}⚠️  Docker is not running${NC}"
    echo "Please start Docker Desktop and try again"
    exit 1
fi

echo -e "${GREEN}✅ Docker is installed and running${NC}"
echo ""

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker-compose down 2>/dev/null || true
echo ""

# Start Docker services
echo "🐳 Starting Docker services (PostgreSQL, Redis, Weaviate)..."
docker-compose up -d db redis weaviate
echo ""

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
max_attempts=30
attempt=0
until docker-compose exec -T db pg_isready -U postgres &> /dev/null || [ $attempt -eq $max_attempts ]; do
    attempt=$((attempt+1))
    echo -n "."
    sleep 1
done
echo ""

if [ $attempt -eq $max_attempts ]; then
    echo -e "${RED}❌ PostgreSQL failed to start${NC}"
    exit 1
fi

echo -e "${GREEN}✅ PostgreSQL is ready${NC}"
echo ""

# Wait for Redis to be ready
echo "⏳ Waiting for Redis to be ready..."
max_attempts=10
attempt=0
until docker-compose exec -T redis redis-cli ping &> /dev/null || [ $attempt -eq $max_attempts ]; do
    attempt=$((attempt+1))
    echo -n "."
    sleep 1
done
echo ""

if [ $attempt -eq $max_attempts ]; then
    echo -e "${YELLOW}⚠️  Redis failed to start (optional service)${NC}"
else
    echo -e "${GREEN}✅ Redis is ready${NC}"
fi
echo ""

# Run database setup
echo "📊 Setting up database..."
cd backend
npm run db:generate
npm run db:migrate 2>/dev/null || npx prisma migrate deploy
cd ..
echo ""

echo -e "${GREEN}✅ Database setup complete${NC}"
echo ""

echo "=========================================="
echo -e "${GREEN}🎉 Setup Complete!${NC}"
echo "=========================================="
echo ""
echo "Your local services are running:"
echo "  🗄️  PostgreSQL:  localhost:5432"
echo "  🔴 Redis:       localhost:6379"
echo "  🧠 Weaviate:    localhost:8081"
echo "  🔧 Adminer:     http://localhost:8080 (DB admin)"
echo ""
echo "To start the application:"
echo "  1. Start backend:  cd backend && npm run dev"
echo "  2. Start frontend: cd frontend && npm run dev"
echo ""
echo "Or run both with:"
echo "  npm run dev"
echo ""
echo "To stop services:"
echo "  docker-compose down"
echo ""
echo "Happy coding! 💻✨"
