import { buildDatabaseUrl } from '../config';

describe('buildDatabaseUrl', () => {
  it('should append pool params to a PostgreSQL URL', () => {
    const result = buildDatabaseUrl(
      'postgresql://user:pass@host:5432/testops',
      25,
      10,
    );
    expect(result).toBe(
      'postgresql://user:pass@host:5432/testops?connection_limit=25&pool_timeout=10',
    );
  });

  it('should handle postgres:// scheme (short alias)', () => {
    const result = buildDatabaseUrl(
      'postgres://user:pass@host:5432/db',
      20,
      15,
    );
    expect(result).toBe(
      'postgres://user:pass@host:5432/db?connection_limit=20&pool_timeout=15',
    );
  });

  it('should use & separator when URL already has query params', () => {
    const result = buildDatabaseUrl(
      'postgresql://user:pass@host:5432/testops?schema=public',
      25,
      10,
    );
    expect(result).toBe(
      'postgresql://user:pass@host:5432/testops?schema=public&connection_limit=25&pool_timeout=10',
    );
  });

  it('should return SQLite file URLs unchanged', () => {
    const url = 'file:./prisma/dev.db';
    expect(buildDatabaseUrl(url, 25, 10)).toBe(url);
  });

  it('should return non-PostgreSQL URLs unchanged', () => {
    const url = 'mysql://user:pass@host:3306/db';
    expect(buildDatabaseUrl(url, 25, 10)).toBe(url);
  });

  it('should handle default pool size of 10', () => {
    const result = buildDatabaseUrl(
      'postgresql://localhost:5432/testops',
      10,
      10,
    );
    expect(result).toContain('connection_limit=10');
    expect(result).toContain('pool_timeout=10');
  });
});
