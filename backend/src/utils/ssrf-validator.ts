/**
 * SSRF Protection — Shared URL Validator
 *
 * Validates that a URL does not target internal/private networks.
 * Blocks: loopback, RFC 1918 private ranges, link-local, IPv6 ULAs.
 */

const BLOCKED_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,          // Link-local
  /^0\./,                 // Current network
  /^fc00:/i,              // IPv6 unique local
  /^fd[0-9a-f]{2}:/i,    // IPv6 unique local
  /^fe80:/i,              // IPv6 link-local
  /^::1$/,                // IPv6 loopback
  /^0:0:0:0:0:0:0:1$/,   // IPv6 loopback (expanded)
  /^\[::1\]$/,            // IPv6 loopback (bracketed)
];

/**
 * Validates that a URL is safe from SSRF (not targeting private/internal networks).
 * Throws if the URL is invalid, uses a non-HTTP protocol, or targets a private IP.
 */
export function validateUrlForSSRF(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid URL format');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only HTTP(S) URLs are allowed');
  }

  const hostname = parsed.hostname.toLowerCase();

  for (const pattern of BLOCKED_HOSTNAME_PATTERNS) {
    if (pattern.test(hostname)) {
      throw new Error('URLs targeting internal or private networks are not allowed');
    }
  }
}

/**
 * Validates that a redirect URL stays on the same origin as the original URL.
 * Prevents SSRF via open-redirect chains.
 */
export function validateSameOrigin(originalUrl: string, redirectUrl: string | undefined | null): void {
  if (!redirectUrl) return;

  try {
    const original = new URL(originalUrl);
    const redirect = new URL(redirectUrl);
    if (original.origin !== redirect.origin) {
      throw new Error('Redirect URL does not match the original origin');
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('origin')) throw err;
    throw new Error('Invalid redirect URL');
  }
}
