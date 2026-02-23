import { schemas } from '../validation';

describe('Monday.com Zod Validation Schemas', () => {
  describe('createMondayItem', () => {
    const schema = schemas.createMondayItem;

    it('should accept valid input', () => {
      const result = schema.safeParse({
        boardId: '123456',
        itemName: 'Fix login bug',
      });
      expect(result.success).toBe(true);
    });

    it('should accept with optional fields', () => {
      const result = schema.safeParse({
        boardId: '123456',
        groupId: 'new_group',
        itemName: 'Fix login bug',
        columnValues: { status: { label: 'Working on it' } },
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing boardId', () => {
      const result = schema.safeParse({ itemName: 'Fix login bug' });
      expect(result.success).toBe(false);
    });

    it('should reject empty boardId', () => {
      const result = schema.safeParse({ boardId: '', itemName: 'Fix login bug' });
      expect(result.success).toBe(false);
    });

    it('should reject missing itemName', () => {
      const result = schema.safeParse({ boardId: '123456' });
      expect(result.success).toBe(false);
    });

    it('should reject empty itemName', () => {
      const result = schema.safeParse({ boardId: '123456', itemName: '' });
      expect(result.success).toBe(false);
    });

    it('should reject itemName exceeding 500 chars', () => {
      const result = schema.safeParse({
        boardId: '123456',
        itemName: 'x'.repeat(501),
      });
      expect(result.success).toBe(false);
    });
  });

  describe('updateMondayItem', () => {
    const schema = schemas.updateMondayItem;

    it('should accept valid input', () => {
      const result = schema.safeParse({
        boardId: '123456',
        columnValues: { status: { label: 'Done' } },
      });
      expect(result.success).toBe(true);
    });

    it('should accept without columnValues', () => {
      const result = schema.safeParse({ boardId: '123456' });
      expect(result.success).toBe(true);
    });

    it('should reject missing boardId', () => {
      const result = schema.safeParse({
        columnValues: { status: { label: 'Done' } },
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty boardId', () => {
      const result = schema.safeParse({ boardId: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('createMondayUpdate', () => {
    const schema = schemas.createMondayUpdate;

    it('should accept valid body', () => {
      const result = schema.safeParse({ body: 'Test failed — see logs' });
      expect(result.success).toBe(true);
    });

    it('should reject missing body', () => {
      const result = schema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject empty body', () => {
      const result = schema.safeParse({ body: '' });
      expect(result.success).toBe(false);
    });

    it('should reject body exceeding 10000 chars', () => {
      const result = schema.safeParse({ body: 'x'.repeat(10001) });
      expect(result.success).toBe(false);
    });
  });

  describe('mondayTestFailure', () => {
    const schema = schemas.mondayTestFailure;

    const validInput = {
      boardId: '123456',
      testRunId: 'run-abc-123',
      testName: 'login.spec.ts > should authenticate user',
      errorMessage: 'Expected true to be false',
    };

    it('should accept valid input', () => {
      const result = schema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should accept with optional fields', () => {
      const result = schema.safeParse({
        ...validInput,
        stackTrace: 'at Object.<anonymous> (login.spec.ts:42:5)',
        groupId: 'failures_group',
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing boardId', () => {
      const { boardId: _, ...rest } = validInput;
      const result = schema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('should reject missing testRunId', () => {
      const { testRunId: _, ...rest } = validInput;
      const result = schema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('should reject missing testName', () => {
      const { testName: _, ...rest } = validInput;
      const result = schema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('should reject missing errorMessage', () => {
      const { errorMessage: _, ...rest } = validInput;
      const result = schema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('should reject testName exceeding 500 chars', () => {
      const result = schema.safeParse({
        ...validInput,
        testName: 'x'.repeat(501),
      });
      expect(result.success).toBe(false);
    });

    it('should reject errorMessage exceeding 5000 chars', () => {
      const result = schema.safeParse({
        ...validInput,
        errorMessage: 'x'.repeat(5001),
      });
      expect(result.success).toBe(false);
    });

    it('should reject stackTrace exceeding 50000 chars', () => {
      const result = schema.safeParse({
        ...validInput,
        stackTrace: 'x'.repeat(50001),
      });
      expect(result.success).toBe(false);
    });
  });
});
