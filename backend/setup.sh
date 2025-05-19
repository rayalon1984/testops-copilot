#!/bin/bash

# Install production dependencies
npm install \
  bcryptjs \
  compression \
  cors \
  dotenv \
  express \
  express-rate-limit \
  helmet \
  jsonwebtoken \
  morgan \
  pg \
  pg-hstore \
  sequelize \
  winston \
  zod

# Install development dependencies
npm install --save-dev \
  @types/bcryptjs \
  @types/compression \
  @types/cors \
  @types/express \
  @types/jsonwebtoken \
  @types/morgan \
  @types/node \
  @types/sequelize \
  @typescript-eslint/eslint-plugin \
  @typescript-eslint/parser \
  eslint \
  eslint-config-prettier \
  eslint-plugin-prettier \
  jest \
  nodemon \
  prettier \
  ts-jest \
  ts-node \
  typescript

# Create necessary directories
mkdir -p src/controllers src/models src/routes src/middleware src/utils src/types src/config src/database

# Make script executable
chmod +x setup.sh

echo "Setup completed successfully!"