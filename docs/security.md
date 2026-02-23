# Security Guide

> **Canonical spec**: [`specs/SECURITY.md`](../specs/SECURITY.md) (v3.0.0) — auth, RBAC, transport, rate limiting, AI gates

## Overview

This guide outlines security best practices and implementations for TestOps Companion.

## Authentication & Authorization

### JWT Implementation

```typescript
// backend/src/services/auth.service.ts
import jwt from 'jsonwebtoken';

class AuthService {
  private generateToken(user: User): string {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      config.jwt.secret,
      {
        expiresIn: config.jwt.expiresIn,
        algorithm: 'HS256',
      }
    );
  }

  private verifyToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, config.jwt.secret) as JwtPayload;
    } catch (error) {
      throw new AuthenticationError('Invalid token');
    }
  }
}
```

### Authentication Middleware

```typescript
// backend/src/middleware/auth.ts
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      throw new AuthenticationError('No token provided');
    }

    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    req.user = await User.findByPk(decoded.id);

    next();
  } catch (error) {
    next(new AuthenticationError('Invalid token'));
  }
};
```

### Role-Based Access Control (RBAC)

```typescript
// backend/src/middleware/rbac.ts
export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AuthenticationError('Not authenticated');
    }

    if (!roles.includes(req.user.role)) {
      throw new AuthorizationError('Not authorized');
    }

    next();
  };
};
```

## Password Security

### Password Hashing

```typescript
// backend/src/services/user.service.ts
import bcrypt from 'bcryptjs';

class UserService {
  private async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(config.security.bcryptSaltRounds);
    return bcrypt.hash(password, salt);
  }

  private async verifyPassword(
    password: string,
    hashedPassword: string
  ): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }
}
```

### Password Policy

```typescript
// backend/src/validators/password.validator.ts
const passwordSchema = z.string()
  .min(12, 'Password must be at least 12 characters')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/,
    'Password must contain uppercase, lowercase, number, and special character'
  );
```

## API Security

### Request Validation

```typescript
// backend/src/middleware/validation.ts
export const validateRequest = (schema: z.ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync(req.body);
      next();
    } catch (error) {
      next(new ValidationError(error.message));
    }
  };
};
```

### Rate Limiting

```typescript
// backend/src/middleware/rateLimit.ts
import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});
```

### Security Headers

```typescript
// backend/src/middleware/security.ts
import helmet from 'helmet';

app.use(helmet());
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:", "https:"],
    connectSrc: ["'self'", "https://api.example.com"],
  },
}));
```

## Data Security

### Encryption at Rest

```typescript
// backend/src/utils/encryption.ts
import crypto from 'crypto';

export class Encryption {
  private algorithm = 'aes-256-gcm';
  private key = crypto.scryptSync(config.security.encryptionKey, 'salt', 32);

  encrypt(text: string): EncryptedData {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  decrypt(data: EncryptedData): string {
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(data.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(data.authTag, 'hex'));
    
    let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
```

### Data Sanitization

```typescript
// backend/src/middleware/sanitization.ts
import sanitizeHtml from 'sanitize-html';

export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  next();
};

const sanitizeObject = (obj: any): any => {
  if (typeof obj !== 'object') {
    return typeof obj === 'string' ? sanitizeHtml(obj) : obj;
  }

  return Object.keys(obj).reduce((acc, key) => ({
    ...acc,
    [key]: sanitizeObject(obj[key]),
  }), {});
};
```

## Session Management

### Session Configuration

```typescript
// backend/src/config/session.ts
import session from 'express-session';
import RedisStore from 'connect-redis';

app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: config.security.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: config.env === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'strict',
  },
}));
```

## Audit Logging

### Security Events

```typescript
// backend/src/services/audit.service.ts
class AuditService {
  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    await SecurityLog.create({
      userId: event.userId,
      action: event.action,
      resource: event.resource,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      metadata: event.metadata,
    });
  }
}
```

## Security Scanning

### Dependencies Scanning

```json
// package.json
{
  "scripts": {
    "security:audit": "npm audit",
    "security:snyk": "snyk test",
    "security:dependencies": "npm-check"
  }
}
```

### Code Scanning

```yaml
# .github/workflows/security.yml
name: Security Scan

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Snyk to check for vulnerabilities
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

## Security Checklist

### Development
- [ ] Use secure dependencies
- [ ] Implement input validation
- [ ] Sanitize output
- [ ] Use parameterized queries
- [ ] Implement proper error handling
- [ ] Use secure defaults

### Deployment
- [ ] Use HTTPS
- [ ] Configure security headers
- [ ] Implement rate limiting
- [ ] Set up monitoring
- [ ] Configure backups
- [ ] Use secure configurations

### Operations
- [ ] Regular security updates
- [ ] Monitor security events
- [ ] Incident response plan
- [ ] Regular security audits
- [ ] Access control review
- [ ] Security training

## Incident Response

### Response Plan

1. Identification
   - Monitor security events
   - Detect anomalies
   - Report incidents

2. Containment
   - Isolate affected systems
   - Block malicious activity
   - Preserve evidence

3. Eradication
   - Remove threat
   - Fix vulnerabilities
   - Update security measures

4. Recovery
   - Restore systems
   - Verify security
   - Monitor for recurrence

5. Lessons Learned
   - Document incident
   - Update procedures
   - Implement improvements