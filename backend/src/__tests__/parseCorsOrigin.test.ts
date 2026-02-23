import { parseCorsOrigin } from '../config';

describe('parseCorsOrigin', () => {
  it('should return a single string for one origin', () => {
    expect(parseCorsOrigin('http://localhost:5173')).toBe('http://localhost:5173');
  });

  it('should return an array for comma-separated origins', () => {
    expect(parseCorsOrigin('https://app.example.com,https://admin.example.com')).toEqual([
      'https://app.example.com',
      'https://admin.example.com',
    ]);
  });

  it('should trim whitespace around origins', () => {
    expect(parseCorsOrigin('https://a.com , https://b.com')).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
  });

  it('should filter empty segments from trailing commas', () => {
    expect(parseCorsOrigin('https://a.com,')).toBe('https://a.com');
  });

  it('should handle three or more origins', () => {
    const result = parseCorsOrigin('https://a.com,https://b.com,https://c.com');
    expect(result).toEqual(['https://a.com', 'https://b.com', 'https://c.com']);
  });
});
