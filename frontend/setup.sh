#!/bin/bash

# Install production dependencies
npm install \
  @emotion/react \
  @emotion/styled \
  @mui/icons-material \
  @mui/material \
  @tanstack/react-query \
  @tanstack/react-query-devtools \
  axios \
  chart.js \
  date-fns \
  formik \
  jwt-decode \
  react \
  react-chartjs-2 \
  react-dom \
  react-error-boundary \
  react-hot-toast \
  react-router-dom \
  react-virtualized \
  yup \
  zustand

# Install development dependencies
npm install --save-dev \
  @storybook/addon-essentials \
  @storybook/addon-interactions \
  @storybook/addon-links \
  @storybook/blocks \
  @storybook/react \
  @storybook/react-vite \
  @storybook/testing-library \
  @testing-library/jest-dom \
  @testing-library/react \
  @testing-library/user-event \
  @types/node \
  @types/react \
  @types/react-dom \
  @types/react-virtualized \
  @typescript-eslint/eslint-plugin \
  @typescript-eslint/parser \
  @vitejs/plugin-react \
  @vitest/coverage-v8 \
  autoprefixer \
  cypress \
  eslint \
  eslint-config-prettier \
  eslint-plugin-cypress \
  eslint-plugin-prettier \
  eslint-plugin-react \
  eslint-plugin-react-hooks \
  eslint-plugin-storybook \
  jsdom \
  msw \
  postcss \
  prettier \
  storybook \
  tailwindcss \
  typescript \
  vite \
  vite-plugin-svgr \
  vite-tsconfig-paths \
  vitest

# Create necessary directories
mkdir -p src/components src/pages src/hooks src/utils src/types src/contexts src/services src/assets src/styles src/config src/constants

# Create assets directories
mkdir -p public/images public/icons

# Make script executable
chmod +x setup.sh

echo "Setup completed successfully!"