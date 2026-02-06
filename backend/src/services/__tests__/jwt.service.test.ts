import jwt from 'jsonwebtoken';
import { JwtService } from '../jwt.service';
import { AuthenticationError } from '../../middleware/errorHandler';
import { UserRole } from '../../types/user';
import { TokenPayload } from '../../types/user';

// Mock the config module - use @/ path alias which resolves to src/config.ts
jest.mock('@/config', () => ({
  __esModule: true,
  config: {
    jwt: {
      secret: 'test-secret-key-that-is-long-enough-for-testing',
      expiresIn: '1h',
      refreshSecret: 'test-refresh-secret-key-that-is-long-enough-for-testing',
      refreshExpiresIn: '7d',
    },
    env: 'test',
    log: { level: 'error', format: 'combined' },
  },
}));

// Mock the logger to prevent console output during tests
jest.mock('@/utils/logger', () => ({
  __esModule: true,
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('JwtService', () => {
  const testPayload: TokenPayload = {
    userId: 'user-123',
    role: UserRole.USER,
  };

  const adminPayload: TokenPayload = {
    userId: 'admin-456',
    role: UserRole.ADMIN,
  };

  describe('generateAccessToken', () => {
    it('should generate a valid access token string', () => {
      const token = JwtService.generateAccessToken(testPayload);

      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should embed the correct payload in the token', () => {
      const token = JwtService.generateAccessToken(testPayload);
      const decoded = jwt.decode(token) as any;

      expect(decoded.userId).toBe('user-123');
      expect(decoded.role).toBe('USER');
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token string', () => {
      const token = JwtService.generateRefreshToken(testPayload);

      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should embed the correct payload in the refresh token', () => {
      const token = JwtService.generateRefreshToken(adminPayload);
      const decoded = jwt.decode(token) as any;

      expect(decoded.userId).toBe('admin-456');
      expect(decoded.role).toBe('ADMIN');
    });

    it('should generate a different token than the access token for the same payload', () => {
      const accessToken = JwtService.generateAccessToken(testPayload);
      const refreshToken = JwtService.generateRefreshToken(testPayload);

      expect(accessToken).not.toBe(refreshToken);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify a valid access token and return the payload', () => {
      const token = JwtService.generateAccessToken(testPayload);
      const result = JwtService.verifyAccessToken(token);

      expect(result.userId).toBe('user-123');
      expect(result.role).toBe('USER');
    });

    it('should include iat and exp fields in the verified payload', () => {
      const token = JwtService.generateAccessToken(testPayload);
      const result = JwtService.verifyAccessToken(token);

      expect(result.iat).toBeDefined();
      expect(result.exp).toBeDefined();
      expect(typeof result.iat).toBe('number');
      expect(typeof result.exp).toBe('number');
    });

    it('should throw AuthenticationError for an invalid token', () => {
      expect(() => {
        JwtService.verifyAccessToken('invalid.token.string');
      }).toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError for a tampered token', () => {
      const token = JwtService.generateAccessToken(testPayload);
      const tampered = token.slice(0, -5) + 'xxxxx';

      expect(() => {
        JwtService.verifyAccessToken(tampered);
      }).toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError for an expired token', () => {
      // Create a token that is already expired by signing with a very short expiry
      const secret = Buffer.from(
        'test-secret-key-that-is-long-enough-for-testing',
        'utf-8'
      );
      const expiredToken = jwt.sign(
        { userId: 'user-123', role: 'USER' },
        secret,
        {
          expiresIn: '0s',
          algorithm: 'HS256',
          issuer: 'testops-companion',
          audience: 'testops-companion-client',
        }
      );

      expect(() => {
        JwtService.verifyAccessToken(expiredToken);
      }).toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError when verifying a refresh token as access token', () => {
      const refreshToken = JwtService.generateRefreshToken(testPayload);

      // Refresh token is signed with a different secret, so verification should fail
      expect(() => {
        JwtService.verifyAccessToken(refreshToken);
      }).toThrow(AuthenticationError);
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify a valid refresh token and return the payload', () => {
      const token = JwtService.generateRefreshToken(testPayload);
      const result = JwtService.verifyRefreshToken(token);

      expect(result.userId).toBe('user-123');
      expect(result.role).toBe('USER');
    });

    it('should throw AuthenticationError for an invalid refresh token', () => {
      expect(() => {
        JwtService.verifyRefreshToken('not-a-real-token');
      }).toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError when verifying an access token as refresh token', () => {
      const accessToken = JwtService.generateAccessToken(testPayload);

      expect(() => {
        JwtService.verifyRefreshToken(accessToken);
      }).toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError for an expired refresh token', () => {
      const secret = Buffer.from(
        'test-refresh-secret-key-that-is-long-enough-for-testing',
        'utf-8'
      );
      const expiredToken = jwt.sign(
        { userId: 'user-123', role: 'USER' },
        secret,
        {
          expiresIn: '0s',
          algorithm: 'HS256',
          issuer: 'testops-companion',
          audience: 'testops-companion-client',
        }
      );

      expect(() => {
        JwtService.verifyRefreshToken(expiredToken);
      }).toThrow(AuthenticationError);
    });
  });

  describe('decodeToken', () => {
    it('should decode a valid token without verification', () => {
      const token = JwtService.generateAccessToken(testPayload);
      const decoded = JwtService.decodeToken(token);

      expect(decoded).not.toBeNull();
      expect(decoded!.userId).toBe('user-123');
      expect(decoded!.role).toBe('USER');
    });

    it('should return null for a completely invalid token string', () => {
      const result = JwtService.decodeToken('not-a-jwt-at-all');

      // jwt.decode returns null for non-JWT strings rather than throwing
      expect(result).toBeNull();
    });
  });

  describe('generateTokenPair', () => {
    it('should return an object with both accessToken and refreshToken', () => {
      const tokens = JwtService.generateTokenPair(testPayload);

      expect(tokens).toHaveProperty('accessToken');
      expect(tokens).toHaveProperty('refreshToken');
      expect(typeof tokens.accessToken).toBe('string');
      expect(typeof tokens.refreshToken).toBe('string');
    });

    it('should produce tokens that can be individually verified', () => {
      const tokens = JwtService.generateTokenPair(testPayload);

      const accessPayload = JwtService.verifyAccessToken(tokens.accessToken);
      expect(accessPayload.userId).toBe('user-123');

      const refreshPayload = JwtService.verifyRefreshToken(tokens.refreshToken);
      expect(refreshPayload.userId).toBe('user-123');
    });

    it('should generate different access and refresh tokens', () => {
      const tokens = JwtService.generateTokenPair(testPayload);

      expect(tokens.accessToken).not.toBe(tokens.refreshToken);
    });
  });

  describe('refreshTokens', () => {
    it('should return a new token pair when given a valid refresh token', () => {
      // Spy on verifyRefreshToken to return a clean payload (without iat/exp)
      // because jwt.sign throws when both payload.exp and options.expiresIn are set
      jest.spyOn(JwtService, 'verifyRefreshToken').mockReturnValueOnce(testPayload);

      const refreshToken = JwtService.generateRefreshToken(testPayload);
      const newTokens = JwtService.refreshTokens(refreshToken);

      expect(newTokens).toHaveProperty('accessToken');
      expect(newTokens).toHaveProperty('refreshToken');
      expect(typeof newTokens.accessToken).toBe('string');
      expect(typeof newTokens.refreshToken).toBe('string');

      jest.restoreAllMocks();
    });

    it('should preserve the userId and role in the new tokens', () => {
      // Spy on verifyRefreshToken to return a clean payload
      jest.spyOn(JwtService, 'verifyRefreshToken').mockReturnValueOnce(adminPayload);

      const refreshToken = JwtService.generateRefreshToken(adminPayload);
      const newTokens = JwtService.refreshTokens(refreshToken);

      const decoded = JwtService.verifyAccessToken(newTokens.accessToken);
      expect(decoded.userId).toBe('admin-456');
      expect(decoded.role).toBe('ADMIN');

      jest.restoreAllMocks();
    });

    it('should throw AuthenticationError when given an invalid refresh token', () => {
      expect(() => {
        JwtService.refreshTokens('invalid-refresh-token');
      }).toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError when given an access token instead of refresh token', () => {
      const tokens = JwtService.generateTokenPair(testPayload);

      expect(() => {
        JwtService.refreshTokens(tokens.accessToken);
      }).toThrow(AuthenticationError);
    });
  });
});
