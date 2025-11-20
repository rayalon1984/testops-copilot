# AI Tests

Test suite for AI-powered features.

## Structure

```
tests/ai/
├── unit/           # Unit tests - isolated component testing
├── integration/    # Integration tests - multi-component testing
└── e2e/           # End-to-end tests - full workflow testing
```

## Running Tests

### All AI Tests
```bash
npm test -- tests/ai/
```

### Unit Tests Only
```bash
npm test -- tests/ai/unit/
```

### Integration Tests Only
```bash
npm test -- tests/ai/integration/
```

### E2E Tests Only
```bash
npm test -- tests/ai/e2e/
```

### With Coverage
```bash
npm test -- tests/ai/ --coverage
```

## Test Guidelines

### Unit Tests
- Test individual functions/classes in isolation
- Mock all external dependencies
- Fast execution (< 1ms per test)
- No network calls, no database, no AI API calls

Example:
```typescript
// tests/ai/unit/redactor.test.ts
describe('DataRedactor', () => {
  it('should redact API keys', () => {
    const redactor = new DataRedactor();
    const input = 'API key: sk-ant-abc123';
    const output = redactor.redact(input);
    expect(output).toBe('API key: [REDACTED]');
  });
});
```

### Integration Tests
- Test multiple components working together
- May use real dependencies (database, vector DB)
- Mock only external API calls (AI providers)
- Moderate execution time (< 100ms per test)

Example:
```typescript
// tests/ai/integration/rca-matching.test.ts
describe('RCA Matching Integration', () => {
  it('should find similar failures using vector DB', async () => {
    // Uses real vector DB, mocked AI provider
    const failure = createTestFailure();
    const similar = await rcaMatching.findSimilar(failure);
    expect(similar).toHaveLength(5);
  });
});
```

### E2E Tests
- Test complete workflows end-to-end
- Use real services (but not production AI APIs)
- Slowest (< 5s per test)
- Test actual user scenarios

Example:
```typescript
// tests/ai/e2e/ai-workflow.test.ts
describe('AI Workflow E2E', () => {
  it('should analyze failure and create ticket', async () => {
    const failure = await createFailure();
    const analysis = await analyzeFailure(failure.id);
    const ticket = await createTicket(failure.id);
    expect(ticket.id).toBeDefined();
  });
});
```

## Mocking AI Providers

Always mock AI provider calls in tests:

```typescript
import { vi } from 'vitest';

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Mocked response' }],
        usage: { input_tokens: 100, output_tokens: 50 }
      })
    }
  }))
}));
```

## Test Data

Use factories for test data:

```typescript
// tests/ai/fixtures/failure.factory.ts
export function createTestFailure(overrides?: Partial<TestFailure>): TestFailure {
  return {
    id: 'test-failure-1',
    testName: 'test_authentication',
    errorMessage: 'Connection timeout',
    timestamp: new Date(),
    ...overrides
  };
}
```

## CI/CD

Tests run automatically on:
- Pull requests
- Commits to main branch
- Release tags

Required:
- All tests must pass
- Coverage > 80%
- No skipped tests in CI

## Debugging Tests

```bash
# Run tests in watch mode
npm test -- tests/ai/ --watch

# Run specific test file
npm test -- tests/ai/unit/redactor.test.ts

# Debug in VSCode
# Use "Debug Test" CodeLens or F5 with test file open
```

## Performance

Test execution time targets:
- Unit test: < 1ms
- Integration test: < 100ms
- E2E test: < 5s
- Full suite: < 30s

If tests are slow, consider:
- Mocking more dependencies
- Using test doubles
- Parallel execution
- Reducing setup/teardown

## Coverage Goals

- Overall: > 80%
- Critical paths: > 95%
- New code: > 90%

View coverage:
```bash
npm test -- tests/ai/ --coverage
open coverage/index.html
```
