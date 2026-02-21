# Testing Guide

> Updated for v3.0.0

This guide covers testing strategies and practices for the TestOps Companion project.

## Testing Stack

### Backend Testing
- Jest for unit and integration testing
- Supertest for API testing
- TestContainers for integration testing
- Mock Service Worker for API mocking

### Frontend Testing
- Vitest for unit testing
- React Testing Library for component testing
- Cypress for E2E testing
- Storybook for component development and testing

## Test Types

### Unit Tests

Test individual components, functions, or modules in isolation.

```typescript
// backend/src/services/__tests__/auth.service.test.ts
describe('AuthService', () => {
  let authService: AuthService;
  
  beforeEach(() => {
    authService = new AuthService();
  });

  it('should validate password correctly', () => {
    const validPassword = 'StrongPass123!';
    const result = authService.validatePassword(validPassword);
    expect(result.isValid).toBe(true);
  });
});

// frontend/src/components/__tests__/Button.test.tsx
describe('Button', () => {
  it('should render with correct text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('should handle click events', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalled();
  });
});
```

### Integration Tests

Test multiple components or services working together.

```typescript
// backend/src/tests/integration/pipeline.test.ts
describe('Pipeline API', () => {
  let app: Express;
  let db: Database;

  beforeAll(async () => {
    db = await createTestDatabase();
    app = createApp({ db });
  });

  it('should create and run pipeline', async () => {
    const response = await request(app)
      .post('/api/v1/pipelines')
      .send({
        name: 'Test Pipeline',
        config: { /* ... */ }
      });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe('Test Pipeline');
  });
});

// frontend/src/tests/integration/PipelineFlow.test.tsx
describe('Pipeline Flow', () => {
  it('should create and run pipeline', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <PipelineCreate />
      </QueryClientProvider>
    );

    await userEvent.type(
      screen.getByLabelText(/pipeline name/i),
      'Test Pipeline'
    );
    await userEvent.click(screen.getByText(/create/i));

    expect(await screen.findByText(/pipeline created/i)).toBeInTheDocument();
  });
});
```

### E2E Tests

Test complete user flows from start to finish.

```typescript
// frontend/cypress/e2e/pipeline.cy.ts
describe('Pipeline Management', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/pipelines');
  });

  it('should create and run a pipeline', () => {
    cy.get('[data-testid="create-pipeline"]').click();
    cy.get('[data-testid="pipeline-name"]').type('E2E Test Pipeline');
    cy.get('[data-testid="pipeline-type"]').select('jenkins');
    cy.get('[data-testid="submit"]').click();
    
    cy.get('[data-testid="pipeline-status"]')
      .should('contain', 'Created');
  });
});
```

## Test Organization

### Directory Structure

```
├── backend/
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   ├── e2e/
│   │   └── fixtures/
│   └── src/
│       └── __tests__/
│
└── frontend/
    ├── tests/
    │   ├── unit/
    │   ├── integration/
    │   └── fixtures/
    ├── cypress/
    │   ├── e2e/
    │   └── fixtures/
    └── src/
        └── __tests__/
```

### Naming Conventions

- Unit tests: `*.test.ts`
- Integration tests: `*.integration.test.ts`
- E2E tests: `*.cy.ts`
- Test fixtures: `*.fixture.ts`

## Test Best Practices

### General Guidelines

1. Follow AAA pattern (Arrange, Act, Assert)
2. Test one thing per test
3. Use meaningful test descriptions
4. Keep tests independent
5. Clean up after tests

```typescript
describe('UserService', () => {
  // Arrange
  beforeEach(() => {
    // Set up test environment
  });

  it('should create user with valid data', async () => {
    // Arrange
    const userData = createValidUserData();

    // Act
    const user = await userService.create(userData);

    // Assert
    expect(user).toMatchObject(userData);
  });

  afterEach(() => {
    // Clean up
  });
});
```

### Mocking

```typescript
// Mock external service
jest.mock('@/services/external', () => ({
  ExternalService: jest.fn().mockImplementation(() => ({
    getData: jest.fn().mockResolvedValue({ data: 'test' })
  }))
}));

// Mock HTTP requests
const server = setupServer(
  rest.get('/api/data', (req, res, ctx) => {
    return res(ctx.json({ data: 'test' }));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### Test Data

```typescript
// fixtures/users.ts
export const createTestUser = (overrides = {}) => ({
  id: 'test-id',
  email: 'test@example.com',
  name: 'Test User',
  ...overrides
});

// Use in tests
const user = createTestUser({ role: 'admin' });
```

## Running Tests

### Backend Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- src/services/__tests__/auth.service.test.ts

# Watch mode
npm run test:watch
```

### Frontend Tests

```bash
# Run unit and integration tests
npm test

# Run E2E tests
npm run test:e2e

# Open Cypress
npm run test:e2e:open

# Run Storybook tests
npm run test:storybook
```

## Test Coverage

### Coverage Requirements

- Backend: 80% overall coverage
- Frontend: 70% overall coverage
- Critical paths: 90% coverage

### Coverage Report

```bash
# Generate coverage report
npm run test:coverage

# View report
open coverage/lcov-report/index.html
```

## Continuous Integration

Tests are run automatically on:
- Pull requests
- Merges to main branch
- Release tags

### CI Pipeline

1. Install dependencies
2. Run linting
3. Run type checking
4. Run unit tests
5. Run integration tests
6. Run E2E tests
7. Generate coverage report
8. Deploy if all tests pass

## Debugging Tests

### Backend Tests

```typescript
// Add debug logs
test('should handle error', () => {
  console.log('Debug:', result);
  expect(result.error).toBeDefined();
});

// Run with debug output
DEBUG=test:* npm test
```

### Frontend Tests

```typescript
// Debug component
screen.debug();

// Debug Cypress
cy.log('Debug info');
```

## Performance Testing

### Load Testing

```bash
# Run k6 load tests
k6 run tests/performance/load-test.js

# Run with metrics
k6 run --out influxdb=http://localhost:8086/k6 tests/performance/load-test.js
```

### Benchmark Tests

```typescript
describe('Performance', () => {
  it('should process data quickly', async () => {
    const start = performance.now();
    await processData();
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(100);
  });
});
```

## Test Maintenance

- Review and update tests regularly
- Remove obsolete tests
- Keep test data up to date
- Monitor test performance
- Update dependencies

## Troubleshooting

Common issues and solutions:

1. Flaky Tests
   - Add retry logic
   - Increase timeouts
   - Improve test isolation

2. Slow Tests
   - Use test parallelization
   - Optimize setup/teardown
   - Mock heavy operations

3. Memory Leaks
   - Clean up resources
   - Monitor memory usage
   - Use leak detection tools