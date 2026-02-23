import { safeParseInt } from '../common';

describe('safeParseInt', () => {
  it('should parse a valid integer', () => {
    expect(safeParseInt('42', 10, 1, 100)).toBe(42);
  });

  it('should return default for undefined', () => {
    expect(safeParseInt(undefined, 50, 1, 500)).toBe(50);
  });

  it('should return default for empty string', () => {
    expect(safeParseInt('', 50, 1, 500)).toBe(50);
  });

  it('should return default for NaN input', () => {
    expect(safeParseInt('abc', 50, 1, 500)).toBe(50);
  });

  it('should return default for float-only string', () => {
    // parseInt('3.14') returns 3, which is valid
    expect(safeParseInt('3.14', 50, 1, 500)).toBe(3);
  });

  it('should clamp to min when value is below', () => {
    expect(safeParseInt('0', 50, 1, 500)).toBe(1);
    expect(safeParseInt('-10', 50, 1, 500)).toBe(1);
  });

  it('should clamp to max when value exceeds', () => {
    expect(safeParseInt('999', 50, 1, 500)).toBe(500);
    expect(safeParseInt('999999', 50, 1, 500)).toBe(500);
  });

  it('should accept values at exact boundaries', () => {
    expect(safeParseInt('1', 50, 1, 500)).toBe(1);
    expect(safeParseInt('500', 50, 1, 500)).toBe(500);
  });

  it('should handle negative min/max ranges', () => {
    expect(safeParseInt('-5', 0, -10, 10)).toBe(-5);
    expect(safeParseInt('-20', 0, -10, 10)).toBe(-10);
  });

  it('should handle very large numbers by clamping', () => {
    expect(safeParseInt('2147483647', 50, 1, 500)).toBe(500);
  });

  it('should return default for whitespace-only string', () => {
    expect(safeParseInt('   ', 50, 1, 500)).toBe(50);
  });
});
