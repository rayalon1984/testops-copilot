/**
 * Sleep for a specified number of milliseconds
 * @param ms Number of milliseconds to sleep
 * @returns Promise that resolves after the specified time
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Generate a random UUID
 * @returns Random UUID string
 */
export const generateUUID = (): string => {
  return crypto.randomUUID();
};

/**
 * Parse JSON safely
 * @param value Value to parse
 * @param defaultValue Default value to return if parsing fails
 * @returns Parsed JSON or default value
 */
export const safeJSONParse = <T>(value: string, defaultValue: T): T => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return defaultValue;
  }
};

/**
 * Check if a value is a valid JSON string
 * @param value Value to check
 * @returns True if value is valid JSON
 */
export const isValidJSON = (value: string): boolean => {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
};

/**
 * Format a date to ISO string without milliseconds
 * @param date Date to format
 * @returns Formatted date string
 */
export const formatDate = (date: Date): string => {
  return date.toISOString().split('.')[0] + 'Z';
};

/**
 * Calculate duration between two dates in milliseconds
 * @param startDate Start date
 * @param endDate End date
 * @returns Duration in milliseconds
 */
export const calculateDuration = (startDate: Date, endDate: Date): number => {
  return endDate.getTime() - startDate.getTime();
};

/**
 * Safely parse an integer from a string with bounds clamping.
 * Returns the default value when the input is undefined, empty, or NaN.
 * Clamps the result to [min, max] to prevent extreme values in DB queries.
 *
 * @param value  Raw string (typically from req.query)
 * @param defaultVal  Fallback when value is missing or unparseable
 * @param min  Lower bound (inclusive)
 * @param max  Upper bound (inclusive)
 */
export const safeParseInt = (
  value: string | undefined,
  defaultVal: number,
  min: number,
  max: number,
): number => {
  if (value === undefined || value === '') return defaultVal;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) return defaultVal;
  return Math.max(min, Math.min(max, parsed));
};