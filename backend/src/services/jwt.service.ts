import jwt, { SignOptions, VerifyOptions } from 'jsonwebtoken';
import { Buffer } from 'buffer';
import { config } from '../config';
import { TokenPayload, AuthTokens } from '../types/user';
import { JWT_CONFIG, ERROR_MESSAGES } from '../constants';
import { AuthenticationError } from '../middleware/errorHandler';

type JwtSignOptions = Omit<SignOptions, 'expiresIn'> & {
  expiresIn: string | number;
};

const baseSignOptions: Omit<SignOptions, 'expiresIn'> = {
  algorithm: JWT_CONFIG.algorithm as jwt.Algorithm,
  issuer: JWT_CONFIG.issuer,
  audience: JWT_CONFIG.audience
};

const verifyOptions: VerifyOptions = {
  algorithms: [JWT_CONFIG.algorithm as jwt.Algorithm],
  issuer: JWT_CONFIG.issuer,
  audience: JWT_CONFIG.audience
};

const getSecret = (secret: string): Buffer => Buffer.from(secret, 'utf-8');

export class JwtService {
  static generateAccessToken(payload: TokenPayload): string {
    try {
      const secret = getSecret(config.jwt.secret);
      const options: JwtSignOptions = {
        ...baseSignOptions,
        expiresIn: config.jwt.expiresIn
      };

      return jwt.sign(
        payload as unknown as Record<string, unknown>,
        secret,
        options as SignOptions
      );
    } catch (error) {
      throw new AuthenticationError('Failed to generate access token');
    }
  }

  static generateRefreshToken(payload: TokenPayload): string {
    try {
      const secret = getSecret(config.jwt.refreshSecret);
      const options: JwtSignOptions = {
        ...baseSignOptions,
        expiresIn: config.jwt.refreshExpiresIn
      };

      return jwt.sign(
        payload as unknown as Record<string, unknown>,
        secret,
        options as SignOptions
      );
    } catch (error) {
      throw new AuthenticationError('Failed to generate refresh token');
    }
  }

  static verifyAccessToken(token: string): TokenPayload {
    try {
      const secret = getSecret(config.jwt.secret);
      const decoded = jwt.verify(token, secret, verifyOptions);
      return decoded as TokenPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthenticationError(ERROR_MESSAGES.TOKEN_EXPIRED);
      }
      throw new AuthenticationError(ERROR_MESSAGES.INVALID_TOKEN);
    }
  }

  static verifyRefreshToken(token: string): TokenPayload {
    try {
      const secret = getSecret(config.jwt.refreshSecret);
      const decoded = jwt.verify(token, secret, verifyOptions);
      return decoded as TokenPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthenticationError(ERROR_MESSAGES.TOKEN_EXPIRED);
      }
      throw new AuthenticationError(ERROR_MESSAGES.INVALID_TOKEN);
    }
  }

  static decodeToken(token: string): TokenPayload | null {
    try {
      const decoded = jwt.decode(token);
      return decoded as TokenPayload;
    } catch {
      return null;
    }
  }

  static generateTokenPair(payload: TokenPayload): AuthTokens {
    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload)
    };
  }

  static refreshTokens(refreshToken: string): AuthTokens {
    const payload = this.verifyRefreshToken(refreshToken);
    return this.generateTokenPair(payload);
  }
}