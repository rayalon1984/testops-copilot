# Development Guide

> Updated for v3.0.0 | **Agent instructions**: [`AGENTS.md`](../AGENTS.md) | **Persona routing**: [`specs/team/TEAM_SELECTION.md`](../specs/team/TEAM_SELECTION.md) | **Coding standards**: [`specs/ARCHITECTURE.md`](../specs/ARCHITECTURE.md)

This guide provides detailed information for developers working on the TestOps Companion project.

## Getting Started

For installation and setup instructions, see the **[Quick Start Guide](quickstart.md)**.

### Recommended VS Code Extensions
- ESLint
- Prettier
- Docker
- GitLens
- Jest Runner
- Mermaid Preview

## Project Structure

```
testops-companion/
├── backend/                 # Backend application
│   ├── src/
│   │   ├── config/         # Configuration files
│   │   ├── controllers/    # Request handlers
│   │   ├── database/       # Database setup and models
│   │   ├── middleware/     # Express middleware
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── types/          # TypeScript type definitions
│   │   └── utils/          # Utility functions
│   ├── tests/              # Test files
│   └── prisma/             # Database schema and migrations
│
├── frontend/               # Frontend application
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── contexts/       # React contexts
│   │   ├── hooks/          # Custom React hooks
│   │   ├── pages/          # Page components
│   │   ├── services/       # API services
│   │   ├── styles/         # Global styles
│   │   ├── types/          # TypeScript type definitions
│   │   └── utils/          # Utility functions
│   └── tests/              # Test files
│
└── docs/                   # Documentation
```

## Coding Standards

### TypeScript Guidelines

- Use TypeScript for all new code
- Enable strict mode
- Define interfaces for all data structures
- Use enums for fixed sets of values
- Avoid using `any` type
- Use type inference when possible

```typescript
// Good
interface User {
  id: string;
  name: string;
  role: UserRole;
}

enum UserRole {
  Admin = 'admin',
  User = 'user',
}

// Bad
const user: any = { id: 1, name: 'John' };
```

### React Guidelines

- Use functional components with hooks
- Implement proper error boundaries
- Use TypeScript for props definitions
- Implement proper loading states
- Handle edge cases and errors

```typescript
interface Props {
  user: User;
  onUpdate: (user: User) => Promise<void>;
}

const UserProfile: React.FC<Props> = ({ user, onUpdate }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Component implementation
};
```

### API Guidelines

- Use RESTful conventions
- Implement proper error handling
- Include request validation
- Document all endpoints
- Include rate limiting
- Implement proper security measures

```typescript
router.post('/users',
  validateInput(createUserSchema),
  rateLimit({ windowMs: 15 * 60 * 1000, max: 5 }),
  async (req, res, next) => {
    try {
      const user = await userService.create(req.body);
      res.status(201).json(user);
    } catch (error) {
      next(error);
    }
  }
);
```

## Testing

### Backend Testing

- Write unit tests for all services
- Write integration tests for API endpoints
- Use Jest for testing
- Aim for high test coverage

```typescript
describe('UserService', () => {
  it('should create a new user', async () => {
    const userData = {
      email: 'test@example.com',
      password: 'password123',
    };
    const user = await userService.create(userData);
    expect(user).toHaveProperty('id');
    expect(user.email).toBe(userData.email);
  });
});
```

### Frontend Testing

- Write unit tests for components
- Write integration tests for pages
- Use React Testing Library
- Implement E2E tests with Cypress

```typescript
describe('LoginPage', () => {
  it('should log in successfully', () => {
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));
    expect(screen.getByText(/welcome/i)).toBeInTheDocument();
  });
});
```

## Git Workflow

1. Create a feature branch:
```bash
git checkout -b feature/new-feature
```

2. Make changes and commit:
```bash
git add .
git commit -m "feat: add new feature"
```

3. Keep branch updated:
```bash
git fetch origin
git rebase origin/main
```

4. Push changes:
```bash
git push origin feature/new-feature
```

5. Create pull request

### Commit Message Format

Follow the Conventional Commits specification:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- feat: New feature
- fix: Bug fix
- docs: Documentation
- style: Code style changes
- refactor: Code refactoring
- test: Adding tests
- chore: Maintenance

## Database Migrations

### Creating a Migration

```bash
cd backend
npm run migrate:dev -- --name add_user_role
```

### Applying Migrations

```bash
npm run migrate
```

## Documentation

- Document all new features
- Update API documentation
- Include JSDoc comments
- Update README when needed
- Document breaking changes

## Performance Considerations

- Implement proper caching
- Optimize database queries
- Use pagination for lists
- Implement proper indexing
- Monitor performance metrics

## Security Guidelines

- Follow OWASP guidelines
- Implement proper authentication
- Use input validation
- Implement rate limiting
- Use secure headers
- Keep dependencies updated

## Debugging

### Backend Debugging

1. Use VS Code debugger:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Backend",
  "program": "${workspaceFolder}/backend/src/server.ts",
  "preLaunchTask": "tsc: build - backend/tsconfig.json",
  "outFiles": ["${workspaceFolder}/backend/dist/**/*.js"]
}
```

### Frontend Debugging

1. Use React Developer Tools
2. Use browser developer tools
3. Use debug logging:
```typescript
const debug = require('debug')('app:component:name');
debug('Debugging information');
```

## Monitoring and Logging

- Use structured logging
- Implement proper error tracking
- Monitor performance metrics
- Set up alerts for issues
- Maintain audit logs

## CI/CD Pipeline

- All tests must pass
- Code coverage requirements
- Linting requirements
- Type checking
- Security scanning
- Performance testing

## Support

- Check existing issues
- Create detailed bug reports
- Include reproduction steps
- Provide relevant logs
- Use issue templates