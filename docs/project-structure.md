# Project Structure

## Overview

TestOps Copilot follows a monorepo structure with separate frontend and backend applications.

```
testops-copilot/
├── backend/                 # Backend application
│   ├── src/                # Source code
│   │   ├── config/         # Configuration files
│   │   ├── controllers/    # Request handlers
│   │   ├── database/       # Database setup and models
│   │   ├── middleware/     # Express middleware
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── types/          # TypeScript type definitions
│   │   └── utils/          # Utility functions
│   ├── tests/              # Test files
│   │   ├── unit/          # Unit tests
│   │   ├── integration/    # Integration tests
│   │   └── e2e/           # End-to-end tests
│   └── prisma/             # Database schema and migrations
│
├── frontend/               # Frontend application
│   ├── src/               # Source code
│   │   ├── components/    # React components
│   │   │   ├── common/    # Shared components
│   │   │   ├── forms/     # Form components
│   │   │   ├── layout/    # Layout components
│   │   │   └── ui/        # UI components
│   │   ├── contexts/      # React contexts
│   │   ├── hooks/         # Custom React hooks
│   │   ├── pages/         # Page components
│   │   ├── services/      # API services
│   │   ├── styles/        # Global styles
│   │   ├── types/         # TypeScript type definitions
│   │   └── utils/         # Utility functions
│   └── tests/             # Test files
│       ├── unit/          # Unit tests
│       ├── integration/   # Integration tests
│       └── e2e/           # End-to-end tests
│
├── docs/                   # Documentation
│   ├── api/               # API documentation
│   ├── architecture/      # Architecture documentation
│   ├── deployment/        # Deployment guides
│   └── development/       # Development guides
│
└── scripts/               # Project scripts
```

## Key Directories

### Backend Structure

#### `backend/src/config/`
Configuration management and environment variables.
```typescript
// config/index.ts
export const config = {
  port: process.env.PORT || 3000,
  database: {
    url: process.env.DATABASE_URL,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
  },
};
```

#### `backend/src/controllers/`
Request handlers for API endpoints.
```typescript
// controllers/pipeline.controller.ts
export class PipelineController {
  async createPipeline(req: Request, res: Response) {
    const pipeline = await pipelineService.create(req.body);
    res.status(201).json(pipeline);
  }
}
```

#### `backend/src/database/`
Database configuration and models.
```typescript
// database/index.ts
export const sequelize = new Sequelize(config.database.url, {
  dialect: 'postgres',
  logging: false,
});
```

#### `backend/src/middleware/`
Express middleware functions.
```typescript
// middleware/auth.ts
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  // Authentication logic
};
```

#### `backend/src/services/`
Business logic implementation.
```typescript
// services/notification.service.ts
export class NotificationService {
  async sendNotification(user: User, message: string) {
    // Notification logic
  }
}
```

### Frontend Structure

#### `frontend/src/components/`
React components organized by feature/type.
```typescript
// components/common/Button.tsx
export const Button: React.FC<ButtonProps> = ({ children, ...props }) => {
  return <button {...props}>{children}</button>;
};
```

#### `frontend/src/contexts/`
React context providers.
```typescript
// contexts/AuthContext.tsx
export const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC = ({ children }) => {
  // Auth context logic
};
```

#### `frontend/src/hooks/`
Custom React hooks.
```typescript
// hooks/usePipeline.ts
export const usePipeline = (id: string) => {
  return useQuery(['pipeline', id], () => fetchPipeline(id));
};
```

#### `frontend/src/pages/`
Page components and routing.
```typescript
// pages/Dashboard.tsx
export const Dashboard: React.FC = () => {
  return (
    <Layout>
      <DashboardContent />
    </Layout>
  );
};
```

#### `frontend/src/services/`
API service integrations.
```typescript
// services/api.ts
export const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});
```

## File Naming Conventions

### Backend
- Controllers: `*.controller.ts`
- Services: `*.service.ts`
- Models: `*.model.ts`
- Routes: `*.routes.ts`
- Middleware: `*.middleware.ts`
- Types: `*.types.ts`
- Tests: `*.test.ts`

### Frontend
- Components: `*.tsx`
- Hooks: `use*.ts`
- Contexts: `*Context.tsx`
- Pages: `*.tsx`
- Services: `*.service.ts`
- Types: `*.types.ts`
- Tests: `*.test.tsx`

## Import Conventions

### Backend
```typescript
// Absolute imports from root
import { config } from '@/config';
import { User } from '@/models/user.model';
import { authMiddleware } from '@/middleware/auth';

// Relative imports for tests
import { mockUser } from '../__mocks__/user';
```

### Frontend
```typescript
// Absolute imports from src
import { Button } from '@/components/common/Button';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/services/api';

// Relative imports for tests
import { render } from '../test-utils';
```

## Configuration Files

### Root Level
```
├── .gitignore              # Git ignore rules
├── .dockerignore           # Docker ignore rules
├── docker-compose.yml      # Docker compose configuration
├── package.json            # Root package.json
└── README.md              # Project documentation
```

### Backend Level
```
├── .env                    # Environment variables
├── .env.example           # Example environment variables
├── tsconfig.json          # TypeScript configuration
├── jest.config.js         # Jest configuration
└── package.json           # Backend package.json
```

### Frontend Level
```
├── .env                    # Environment variables
├── .env.example           # Example environment variables
├── tsconfig.json          # TypeScript configuration
├── vite.config.ts         # Vite configuration
├── tailwind.config.js     # Tailwind configuration
└── package.json           # Frontend package.json
```

## Best Practices

1. Keep components small and focused
2. Use TypeScript for all new code
3. Write tests for all new features
4. Follow naming conventions
5. Document complex logic
6. Use proper error handling
7. Implement proper logging
8. Follow security best practices
9. Optimize performance
10. Maintain code quality