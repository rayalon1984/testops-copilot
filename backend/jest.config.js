// Provide required env vars for tests that import config.ts directly without mocking
// (e.g. buildDatabaseUrl.test.ts, parseCorsOrigin.test.ts, monday-validation.test.ts)
// These fallbacks are only used when env vars are not already set (e.g. from .env.dev).
const testEnvDefaults = {
  DATABASE_URL: 'file:./prisma/test.db',
  JWT_SECRET: 'test-jwt-secret-must-be-at-least-32-characters-long',
  JWT_REFRESH_SECRET: 'test-jwt-refresh-secret-must-be-at-least-32-chars',
  SESSION_SECRET: 'test-session-secret-must-be-at-least-32-characters',
};
for (const [key, value] of Object.entries(testEnvDefaults)) {
  process.env[key] = process.env[key] || value;
}

module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/*.test.ts', '**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        moduleResolution: 'node',
        esModuleInterop: true,
      },
    }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/types/**',
    '!src/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/__tests__/helpers/'],
};
