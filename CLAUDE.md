# TestOps Companion - AI Assistant Development Guide

> **Last Updated**: 2026-01-04
> **Version**: 2.5.5
> **Purpose**: Comprehensive guide for AI assistants working on TestOps Companion

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture Overview](#architecture-overview)
3. [Backend Architecture](#backend-architecture)
4. [Frontend Architecture](#frontend-architecture)
5. [Development Workflows](#development-workflows)
6. [Coding Conventions](#coding-conventions)
7. [Common Development Tasks](#common-development-tasks)
8. [Testing Guidelines](#testing-guidelines)
9. [Git Workflow](#git-workflow)
10. [Integration Patterns](#integration-patterns)
11. [AI-Specific Guidance](#ai-specific-guidance)
12. [Troubleshooting](#troubleshooting)

---

## Project Overview

TestOps Companion is a comprehensive test operations platform for managing CI/CD pipelines, tracking test results, and analyzing failures across testing infrastructure.

### Tech Stack Summary

**Backend**: Node.js 18+ | TypeScript | Express.js | Prisma ORM | PostgreSQL | Redis | JWT Auth
**Frontend**: React 18 | TypeScript | Material-UI | Zustand | React Query | Vite
**AI**: Anthropic Claude | OpenAI GPT-4 | Google Gemini | Azure OpenAI | Weaviate Vector DB
**DevOps**: Docker | GitHub Actions | Playwright E2E

### Project Structure

```
testops-companion/
├── backend/              # Express.js API server
│   ├── prisma/          # Database schema and migrations
│   ├── src/
│   │   ├── controllers/ # HTTP request handlers
│   │   ├── services/    # Business logic layer
│   │   ├── middleware/  # Express middleware
│   │   ├── routes/      # API route definitions
│   │   ├── types/       # TypeScript type definitions
│   │   ├── utils/       # Utility functions
│   │   └── constants/   # Shared constants
│   └── package.json
├── frontend/            # React SPA
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── pages/       # Page-level components
│   │   ├── contexts/    # React contexts
│   │   ├── hooks/       # Custom hooks
│   │   └── test/        # Test utilities
│   └── package.json
├── docs/                # Documentation
├── scripts/             # Build and setup scripts
└── package.json         # Root workspace config
```

---

## Architecture Overview

### System Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   React     │─────▶│   Express    │─────▶│ PostgreSQL  │
│  Frontend   │      │   Backend    │      │  Database   │
│  (Vite)     │◀─────│    (API)     │      └─────────────┘
└─────────────┘ JWT  └──────────────┘
                            │
                            ├─────▶ Redis (Cache)
                            ├─────▶ Weaviate (Vector DB)
                            ├─────▶ AI Providers
                            └─────▶ External Integrations
```

### Request Flow

```
User → Frontend → API Gateway → Auth Middleware → Route Handler → Controller → Service → Database
                                                                                    ↓
                                                                          External Integrations
```

### Key Design Principles

1. **Separation of Concerns**: Controllers handle HTTP, Services handle business logic
2. **Type Safety**: Strict TypeScript throughout the stack
3. **API Versioning**: All routes prefixed with `/api/v1/`
4. **Error Handling**: Custom error classes with centralized error handler
5. **Security**: JWT authentication, Helmet middleware, CORS configuration
6. **Scalability**: Service-oriented architecture, Redis caching, queue-based processing

---

## Backend Architecture

### Directory Structure

```
backend/src/
├── controllers/           # HTTP request handlers (thin layer)
│   ├── auth.controller.ts
│   ├── testRun.controller.ts
│   ├── pipeline.controller.ts
│   ├── notification.controller.ts
│   ├── jira.controller.ts
│   ├── confluence.controller.ts
│   ├── failure-archive.controller.ts
│   └── metrics.controller.ts
├── services/              # Business logic (thick layer)
│   ├── testRun.service.ts
│   ├── notification.service.ts
│   ├── jira.service.ts
│   ├── jenkins.service.ts
│   ├── github.service.ts
│   ├── confluence.service.ts
│   ├── testrail.service.ts
│   ├── jwt.service.ts
│   ├── metrics.service.ts
│   └── ai/               # AI services subdirectory
│       ├── manager.ts    # AI orchestrator (singleton)
│       ├── config.ts     # AI configuration
│       ├── cache.ts      # Response caching
│       ├── cost-tracker.ts
│       ├── providers/    # AI provider implementations
│       │   ├── base.provider.ts
│       │   ├── anthropic.provider.ts
│       │   ├── openai.provider.ts
│       │   ├── google.provider.ts
│       │   └── azure.provider.ts
│       ├── features/     # AI feature modules
│       │   ├── rca-matching.ts
│       │   ├── categorization.ts
│       │   └── log-summary.ts
│       └── vector/       # Vector DB operations
│           ├── client.ts
│           ├── search.ts
│           └── schema.ts
├── middleware/           # Express middleware
│   ├── auth.ts          # JWT authentication
│   ├── errorHandler.ts  # Error handling
│   └── validation.ts    # Zod schema validation
├── routes/              # Route definitions
│   ├── index.ts         # Route registration
│   ├── auth.routes.ts
│   ├── testRun.routes.ts
│   ├── pipeline.routes.ts
│   └── ai.routes.ts
├── types/               # TypeScript definitions
│   ├── error.ts         # Custom error classes
│   ├── user.ts
│   ├── pipeline.ts
│   ├── jira.ts
│   └── middleware.ts
├── utils/               # Utility functions
│   ├── logger.ts        # Winston logger
│   ├── common.ts
│   └── prismaHelpers.ts
├── constants/           # Shared constants
│   └── index.ts
└── index.ts            # Application entry point
```

### Service Layer Pattern

**Purpose**: Encapsulate business logic, database operations, and external integrations

**Pattern**:
```typescript
// backend/src/services/testRun.service.ts
export class TestRunService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async getAllTestRuns(
    userId: string,
    filters: TestRunFilters
  ): Promise<TestRun[]> {
    // Business logic with Prisma queries
    const where = this.buildWhereClause(filters, userId);
    return await this.prisma.testRun.findMany({ where });
  }

  async createTestRun(
    data: CreateTestRunDTO,
    userId: string
  ): Promise<TestRun> {
    // Validation and creation logic
    return await this.prisma.testRun.create({ data: { ...data, userId } });
  }
}

// Export DTOs for type safety
export interface CreateTestRunDTO {
  pipelineId: string;
  name: string;
  branch?: string;
  status: TestStatus;
}
```

**When to Create a New Service**:
- New domain entity (e.g., `TestRun`, `Pipeline`, `FailureArchive`)
- External integration (e.g., `JiraService`, `SlackService`)
- Complex business logic that doesn't fit in controllers

### Controller Layer Pattern

**Purpose**: Handle HTTP-specific logic (request/response)

**Pattern**:
```typescript
// backend/src/controllers/testRun.controller.ts
import { Request, Response, NextFunction } from 'express';
import { TestRunService } from '@/services/testRun.service';
import { NotFoundError } from '@/types/error';

export class TestRunController {
  private testRunService: TestRunService;

  constructor() {
    this.testRunService = new TestRunService();
  }

  async getAllTestRuns(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.id; // From auth middleware
      const filters = this.parseFilters(req.query);

      const testRuns = await this.testRunService.getAllTestRuns(userId, filters);

      res.json({
        success: true,
        data: testRuns,
        count: testRuns.length
      });
    } catch (error) {
      next(error); // Pass to error handler
    }
  }

  private parseFilters(query: any): TestRunFilters {
    // Parse and validate query parameters
    return {
      pipelineId: query.pipelineId,
      status: query.status,
      startDate: query.startDate,
      endDate: query.endDate
    };
  }
}
```

**Controller Responsibilities**:
- Parse request parameters
- Call service methods
- Format responses
- Delegate errors to error handler

### Middleware Patterns

#### Authentication Middleware

```typescript
// backend/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import { AuthenticationError } from '@/types/error';
import { jwtService } from '@/services/jwt.service';

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractToken(req);
    if (!token) {
      throw new AuthenticationError('No token provided');
    }

    const payload = await jwtService.verifyAccessToken(token);
    req.user = payload; // Attach user to request
    next();
  } catch (error) {
    next(new AuthenticationError('Invalid token'));
  }
}

export function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AuthorizationError('Insufficient permissions'));
    }
    next();
  };
}
```

#### Validation Middleware

```typescript
// backend/src/middleware/validation.ts
import { z } from 'zod';
import { ValidationError } from '@/types/error';

export function validate(schema: z.ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(new ValidationError(error.errors));
      } else {
        next(error);
      }
    }
  };
}

// Usage in routes
const createTestRunSchema = z.object({
  pipelineId: z.string().uuid(),
  name: z.string().min(1),
  branch: z.string().optional()
});

router.post('/',
  authenticate,
  validate(createTestRunSchema),
  asyncHandler(controller.createTestRun)
);
```

### Error Handling Pattern

**Custom Error Classes** (`backend/src/types/error.ts`):

```typescript
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Resource not found') {
    super(404, message);
  }
}

export class ValidationError extends ApiError {
  constructor(details: any) {
    super(400, 'Validation failed', details);
  }
}

export class AuthenticationError extends ApiError {
  constructor(message = 'Authentication failed') {
    super(401, message);
  }
}

export class AuthorizationError extends ApiError {
  constructor(message = 'Insufficient permissions') {
    super(403, message);
  }
}
```

**Error Handler Middleware**:

```typescript
// backend/src/middleware/errorHandler.ts
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  logger.error('Error:', err);

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      details: err.details,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  }

  // Unknown errors
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && {
      message: err.message,
      stack: err.stack
    })
  });
}
```

### Database Patterns (Prisma)

**Schema Location**: `backend/prisma/schema.prisma`

**Key Models**:
- `User`: Authentication and user management
- `Pipeline`: CI/CD pipeline configuration
- `TestRun`: Test execution records
- `TestResult`: Individual test case results
- `FailureArchive`: Comprehensive failure documentation
- `JiraIssue`, `ConfluencePage`, `TestRailRun`: Integration tracking
- `AIUsage`: AI cost and usage tracking
- `Notification`: User notifications

**Common Patterns**:

```typescript
// Service method with Prisma
async getTestRunById(id: string, userId: string): Promise<TestRun> {
  const testRun = await this.prisma.testRun.findUnique({
    where: { id },
    include: {
      pipeline: true,
      results: {
        where: { status: 'FAILED' },
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (!testRun || testRun.userId !== userId) {
    throw new NotFoundError('Test run not found');
  }

  return testRun;
}

// Transaction example
async createTestRunWithResults(data: CreateTestRunDTO): Promise<TestRun> {
  return await this.prisma.$transaction(async (tx) => {
    const testRun = await tx.testRun.create({ data: { ...data } });

    const results = data.results.map(r => ({
      ...r,
      testRunId: testRun.id
    }));

    await tx.testResult.createMany({ data: results });

    return testRun;
  });
}
```

**Migration Workflow**:
```bash
# 1. Modify schema.prisma
# 2. Create migration
npx prisma migrate dev --name add_new_field

# 3. Generate Prisma client
npx prisma generate

# 4. Apply in production
npx prisma migrate deploy
```

### AI Integration Architecture

**Location**: `backend/src/services/ai/`

**Pattern**: Plugin-based provider system with centralized orchestration

**AIManager Singleton**:
```typescript
// backend/src/services/ai/manager.ts
class AIManager {
  private static instance: AIManager;
  private provider: BaseProvider;
  private vectorClient: WeaviateClient;
  private cache: AICache;
  private costTracker: CostTracker;

  private constructor() {
    this.provider = ProviderRegistry.getProvider(config.provider);
    this.vectorClient = new WeaviateClient();
    this.cache = new AICache();
    this.costTracker = new CostTracker();
  }

  static getInstance(): AIManager {
    if (!this.instance) {
      this.instance = new AIManager();
    }
    return this.instance;
  }

  async findSimilarFailures(failure: FailureInput): Promise<SimilarFailure[]> {
    // RCA matching feature
  }

  async categorizeFailure(failure: FailureInput): Promise<FailureCategory> {
    // Failure categorization feature
  }

  async summarizeLogs(logs: string): Promise<LogSummary> {
    // Log summarization feature
  }
}

export const getAIManager = () => AIManager.getInstance();
```

**Provider Pattern**:
```typescript
// backend/src/services/ai/providers/base.provider.ts
export abstract class BaseProvider {
  abstract getName(): AIProviderName;

  abstract chat(
    messages: ChatMessage[],
    options?: CompletionOptions
  ): Promise<AIResponse>;

  abstract embed(
    text: string,
    options?: EmbeddingOptions
  ): Promise<number[]>;

  abstract healthCheck(): Promise<boolean>;

  protected async trackUsage(usage: UsageData): Promise<void> {
    // Record cost and token usage
  }
}

// Example implementation
export class AnthropicProvider extends BaseProvider {
  private client: Anthropic;

  constructor(apiKey: string) {
    super();
    this.client = new Anthropic({ apiKey });
  }

  getName(): AIProviderName {
    return 'anthropic';
  }

  async chat(messages: ChatMessage[], options?: CompletionOptions): Promise<AIResponse> {
    const response = await this.client.messages.create({
      model: options?.model || 'claude-sonnet-4.5',
      messages,
      max_tokens: options?.maxTokens || 4096
    });

    await this.trackUsage({
      provider: 'anthropic',
      tokens: response.usage.total_tokens,
      cost: this.calculateCost(response.usage)
    });

    return this.formatResponse(response);
  }
}
```

**Adding New AI Features**:

1. Create feature module in `services/ai/features/`
2. Implement feature logic using AIManager
3. Register routes in `routes/ai.routes.ts`
4. Add cost tracking and caching
5. Update AI configuration with feature flags

---

## Frontend Architecture

### Directory Structure

```
frontend/src/
├── components/           # Reusable UI components
│   ├── Layout/          # App layout wrapper
│   ├── PageHeader/      # Page header component
│   ├── ConfirmDialog/   # Confirmation dialog
│   ├── LogViewer/       # Log display component
│   ├── RCADocumentModal/
│   ├── SimilarFailuresAlert/
│   ├── ErrorBoundary/
│   └── ProtectedRoute/  # Auth route wrapper
├── pages/               # Page-level components
│   ├── Dashboard.tsx
│   ├── Login.tsx
│   ├── PipelineList.tsx
│   ├── PipelineDetail.tsx
│   ├── TestRunList.tsx
│   ├── TestRunDetail.tsx
│   ├── FailureKnowledgeBase.tsx
│   ├── CostTracker.tsx
│   ├── NotificationList.tsx
│   └── Settings.tsx
├── contexts/            # React contexts
│   ├── AuthContext.tsx  # Authentication state
│   └── DesignModeContext.tsx
├── hooks/               # Custom hooks
│   └── useAuth.ts
├── test/                # Test utilities
│   ├── setup.ts
│   └── test-utils.tsx
└── App.tsx             # Root component
```

### Component Pattern

**Functional Components with TypeScript**:

```typescript
// frontend/src/components/ConfirmDialog/ConfirmDialog.tsx
import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  severity?: 'info' | 'warning' | 'error';
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  severity = 'info'
}: ConfirmDialogProps): JSX.Element {
  return (
    <Dialog open={open} onClose={onCancel}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>{message}</DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{cancelText}</Button>
        <Button
          onClick={onConfirm}
          color={severity === 'error' ? 'error' : 'primary'}
          variant="contained"
        >
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

### State Management

**Server State**: React Query (@tanstack/react-query)

```typescript
// In page components
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

function TestRunList() {
  const queryClient = useQueryClient();

  // Fetch data
  const { data: testRuns, isLoading, error } = useQuery({
    queryKey: ['testRuns', filters],
    queryFn: () => fetchTestRuns(filters),
    staleTime: 30000,
    retry: 1
  });

  // Mutate data
  const createMutation = useMutation({
    mutationFn: createTestRun,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testRuns'] });
      showNotification('Test run created');
    },
    onError: (error) => {
      showError(error.message);
    }
  });

  return (
    <div>
      {isLoading && <LoadingSpinner />}
      {error && <ErrorAlert error={error} />}
      {testRuns?.map(run => <TestRunCard key={run.id} run={run} />)}
    </div>
  );
}
```

**Global UI State**: React Context API

```typescript
// frontend/src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useCallback } from 'react';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const login = useCallback(async (email: string, password: string) => {
    const response = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    localStorage.setItem('accessToken', data.accessToken);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/v1/auth/logout', { method: 'POST' });
    localStorage.removeItem('accessToken');
    setUser(null);
  }, []);

  const value = {
    user,
    isAuthenticated: !!user,
    login,
    logout,
    refreshAuth
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

### API Communication

**Pattern**: Direct fetch/axios calls with React Query

```typescript
// In page components - using axios
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

async function fetchTestRuns(filters: TestRunFilters): Promise<TestRun[]> {
  const token = localStorage.getItem('accessToken');

  const response = await axios.get(`${API_BASE}/test-runs`, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    params: filters
  });

  return response.data.data;
}

async function createTestRun(data: CreateTestRunDTO): Promise<TestRun> {
  const token = localStorage.getItem('accessToken');

  const response = await axios.post(`${API_BASE}/test-runs`, data, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  return response.data.data;
}
```

### Routing Pattern

**React Router v6**:

```typescript
// frontend/src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Layout } from '@/components/Layout';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/pipelines" element={<PipelineList />} />
          <Route path="/pipelines/:id" element={<PipelineDetail />} />
          <Route path="/test-runs" element={<TestRunList />} />
          <Route path="/test-runs/:id" element={<TestRunDetail />} />
          <Route path="/failure-knowledge-base" element={<FailureKnowledgeBase />} />
          <Route path="/cost-tracker" element={<CostTracker />} />
          <Route path="/notifications" element={<NotificationList />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

**Protected Route Component**:

```typescript
// frontend/src/components/ProtectedRoute/index.tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
```

### Material-UI Theming

```typescript
// frontend/src/theme.ts
import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    error: {
      main: '#f44336',
    },
    warning: {
      main: '#ff9800',
    },
    success: {
      main: '#4caf50',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 500,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
  },
});
```

---

## Development Workflows

### Environment Setup

**Prerequisites**:
- Node.js 18+
- npm 9+
- PostgreSQL 14+ (production mode)
- Redis (optional, for caching)
- Weaviate (optional, for AI features)

**Quick Setup**:
```bash
# Clone repository
git clone https://github.com/rayalon1984/testops-companion.git
cd testops-companion

# Automated setup
npm run setup

# Start development servers
npm run dev
```

### Development Modes

**Demo Mode (Simplified)**:
```bash
npm run dev:simple
# - Uses SQLite in-memory database
# - Pre-seeded with demo data
# - Auto-opens browser
# - No external dependencies
```

**Production Mode (Full Stack)**:
```bash
npm run local:start  # Start Docker services
npm run dev          # Start backend + frontend
# - PostgreSQL database
# - Redis caching
# - Weaviate vector DB
# - Full integrations
```

### Development Scripts

```bash
# Development
npm run dev                  # Start both backend and frontend
npm run dev:backend          # Backend only (port 3000)
npm run dev:frontend         # Frontend only (port 5173)
npm run dev:simple           # Demo mode

# Building
npm run build                # Build both projects
npm run build:backend        # Build backend
npm run build:frontend       # Build frontend

# Testing
npm run test                 # Run all tests
npm run test:backend         # Backend tests (Jest)
npm run test:frontend        # Frontend tests (Vitest)

# Code Quality
npm run lint                 # Lint both projects
npm run lint:backend         # Lint backend
npm run lint:frontend        # Lint frontend
npm run typecheck            # Type check both projects

# Database
cd backend
npm run db:migrate           # Run migrations
npm run db:generate          # Generate Prisma client
npm run db:seed              # Seed database
npm run db:studio            # Open Prisma Studio
npm run db:reset             # Reset database (⚠️ destructive)
```

### Adding New Features

#### Backend Feature (API Endpoint)

1. **Define Types** (`backend/src/types/feature.ts`):
```typescript
export interface Feature {
  id: string;
  name: string;
  // ...
}

export interface CreateFeatureDTO {
  name: string;
  // ...
}
```

2. **Create Service** (`backend/src/services/feature.service.ts`):
```typescript
export class FeatureService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async createFeature(data: CreateFeatureDTO, userId: string): Promise<Feature> {
    return await this.prisma.feature.create({
      data: { ...data, userId }
    });
  }

  async getFeatureById(id: string): Promise<Feature> {
    const feature = await this.prisma.feature.findUnique({ where: { id } });
    if (!feature) throw new NotFoundError('Feature not found');
    return feature;
  }
}
```

3. **Create Controller** (`backend/src/controllers/feature.controller.ts`):
```typescript
export class FeatureController {
  private featureService: FeatureService;

  constructor() {
    this.featureService = new FeatureService();
  }

  async createFeature(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const feature = await this.featureService.createFeature(req.body, req.user!.id);
      res.status(201).json({ success: true, data: feature });
    } catch (error) {
      next(error);
    }
  }
}

export const featureController = new FeatureController();
```

4. **Add Routes** (`backend/src/routes/feature.routes.ts`):
```typescript
import { Router } from 'express';
import { featureController } from '@/controllers/feature.controller';
import { authenticate } from '@/middleware/auth';
import { validate } from '@/middleware/validation';
import { asyncHandler } from '@/middleware/errorHandler';

const router = Router();

router.post('/',
  authenticate,
  validate(createFeatureSchema),
  asyncHandler(featureController.createFeature)
);

router.get('/:id',
  authenticate,
  asyncHandler(featureController.getFeatureById)
);

export default router;
```

5. **Register Routes** (`backend/src/routes/index.ts`):
```typescript
import featureRoutes from './feature.routes';

export function registerRoutes(app: Express) {
  // ... existing routes
  app.use('/api/v1/features', featureRoutes);
}
```

#### Frontend Feature (Page/Component)

1. **Create Page Component** (`frontend/src/pages/FeatureList.tsx`):
```typescript
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Container, Button, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import { PageHeader } from '@/components/PageHeader';

export function FeatureList() {
  const queryClient = useQueryClient();

  const { data: features, isLoading } = useQuery({
    queryKey: ['features'],
    queryFn: fetchFeatures
  });

  const createMutation = useMutation({
    mutationFn: createFeature,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['features'] });
    }
  });

  return (
    <Container>
      <PageHeader title="Features" />

      <Button onClick={() => createMutation.mutate(newFeatureData)}>
        Create Feature
      </Button>

      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {features?.map(feature => (
            <TableRow key={feature.id}>
              <TableCell>{feature.name}</TableCell>
              <TableCell>{feature.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Container>
  );
}

// API functions
async function fetchFeatures(): Promise<Feature[]> {
  const token = localStorage.getItem('accessToken');
  const response = await axios.get('/api/v1/features', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data.data;
}

async function createFeature(data: CreateFeatureDTO): Promise<Feature> {
  const token = localStorage.getItem('accessToken');
  const response = await axios.post('/api/v1/features', data, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data.data;
}
```

2. **Add Route** (`frontend/src/App.tsx`):
```typescript
import { FeatureList } from '@/pages/FeatureList';

// Inside Routes
<Route path="/features" element={<FeatureList />} />
```

---

## Coding Conventions

### TypeScript Standards

1. **Strict Mode**: Always enable strict mode
2. **Explicit Types**: Define explicit return types for functions
3. **Interfaces over Types**: Use interfaces for object shapes
4. **Enums**: Use string enums for constants
5. **No Any**: Avoid `any` type, use `unknown` if necessary

```typescript
// ✅ Good
interface User {
  id: string;
  email: string;
  role: UserRole;
}

async function getUser(id: string): Promise<User> {
  // ...
}

enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER'
}

// ❌ Bad
function getUser(id: any): any {
  // ...
}
```

### Naming Conventions

**Files**:
- Components: `PascalCase.tsx` (e.g., `UserProfile.tsx`)
- Services: `camelCase.service.ts` (e.g., `testRun.service.ts`)
- Controllers: `camelCase.controller.ts` (e.g., `auth.controller.ts`)
- Types: `camelCase.ts` (e.g., `user.ts`)
- Tests: `*.test.ts` or `*.test.tsx`

**Code**:
- Classes: `PascalCase` (e.g., `TestRunService`)
- Functions: `camelCase` (e.g., `getUserById`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `API_BASE_URL`)
- Interfaces: `PascalCase` (e.g., `TestRunFilters`)
- Types: `PascalCase` (e.g., `CreateTestRunDTO`)

### Code Organization

**Imports Order**:
```typescript
// 1. External libraries
import React from 'react';
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

// 2. Internal modules (using path aliases)
import { TestRunService } from '@/services/testRun.service';
import { authenticate } from '@/middleware/auth';
import { NotFoundError } from '@/types/error';

// 3. Relative imports
import { helper } from './utils';
```

**Function Organization**:
```typescript
export class TestRunService {
  // 1. Properties
  private prisma: PrismaClient;

  // 2. Constructor
  constructor() {
    this.prisma = new PrismaClient();
  }

  // 3. Public methods
  async getAllTestRuns(): Promise<TestRun[]> {
    // ...
  }

  async getTestRunById(id: string): Promise<TestRun> {
    // ...
  }

  // 4. Private methods
  private buildWhereClause(filters: TestRunFilters) {
    // ...
  }
}
```

### Error Handling

**Always use try-catch in async functions**:
```typescript
// Backend
async function handleRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.doSomething();
    res.json(result);
  } catch (error) {
    next(error); // Pass to error handler
  }
}

// Frontend
async function fetchData() {
  try {
    const response = await axios.get('/api/endpoint');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch data:', error);
    throw error; // Let React Query handle it
  }
}
```

**Throw custom errors**:
```typescript
// ✅ Good
if (!user) {
  throw new NotFoundError('User not found');
}

// ❌ Bad
if (!user) {
  throw new Error('User not found');
}
```

### Logging

**Backend**:
```typescript
import { logger } from '@/utils/logger';

// Use appropriate log levels
logger.info('User logged in', { userId: user.id });
logger.warn('High memory usage', { usage: memoryUsage });
logger.error('Database connection failed', { error });
logger.debug('Query execution time', { query, time });
```

**Frontend**:
```typescript
// Use console methods appropriately
console.log('Component mounted'); // Development only
console.error('Failed to fetch data', error); // Errors
console.warn('Deprecated feature used'); // Warnings
```

### Comments and Documentation

**JSDoc for public APIs**:
```typescript
/**
 * Creates a new test run
 * @param data - Test run creation data
 * @param userId - ID of the user creating the test run
 * @returns Created test run
 * @throws {ValidationError} If data is invalid
 * @throws {NotFoundError} If pipeline doesn't exist
 */
async createTestRun(data: CreateTestRunDTO, userId: string): Promise<TestRun> {
  // Implementation
}
```

**Inline comments for complex logic**:
```typescript
// Calculate weighted average considering test importance
const weightedScore = results.reduce((acc, result) => {
  const weight = result.importance || 1;
  return acc + (result.score * weight);
}, 0) / totalWeight;
```

---

## Common Development Tasks

### Adding a Database Model

1. **Update Prisma Schema** (`backend/prisma/schema.prisma`):
```prisma
model NewModel {
  id        String   @id @default(uuid())
  name      String
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
  @@map("new_models")
}

// Add relation to User model
model User {
  // ...
  newModels NewModel[]
}
```

2. **Create Migration**:
```bash
cd backend
npx prisma migrate dev --name add_new_model
```

3. **Generate Prisma Client**:
```bash
npx prisma generate
```

### Adding an Integration

1. **Create Service** (`backend/src/services/integration.service.ts`):
```typescript
export class IntegrationService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.INTEGRATION_API_KEY || '';
    this.baseUrl = process.env.INTEGRATION_BASE_URL || '';
  }

  async createIssue(data: IssueData): Promise<Issue> {
    const response = await axios.post(
      `${this.baseUrl}/issues`,
      data,
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  }
}
```

2. **Add Environment Variables** (`backend/.env`):
```env
INTEGRATION_API_KEY=your_api_key
INTEGRATION_BASE_URL=https://api.integration.com
```

3. **Create Controller and Routes**
4. **Add Tests**
5. **Document in `docs/integrations/`**

### Adding AI Features

1. **Create Feature Module** (`backend/src/services/ai/features/newFeature.ts`):
```typescript
import { getAIManager } from '../manager';
import { ChatMessage } from '../types';

export interface NewFeatureInput {
  data: string;
  context?: string;
}

export interface NewFeatureOutput {
  result: string;
  confidence: number;
}

export async function executeNewFeature(
  input: NewFeatureInput
): Promise<NewFeatureOutput> {
  const aiManager = getAIManager();

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: 'You are an expert at...'
    },
    {
      role: 'user',
      content: `Analyze: ${input.data}`
    }
  ];

  const response = await aiManager.chat(messages, {
    temperature: 0.7,
    maxTokens: 2000
  });

  return {
    result: response.content,
    confidence: response.metadata?.confidence || 0.5
  };
}
```

2. **Add Route** (`backend/src/routes/ai.routes.ts`):
```typescript
router.post('/new-feature',
  authenticate,
  validate(newFeatureSchema),
  asyncHandler(async (req, res) => {
    const result = await executeNewFeature(req.body);
    res.json({ success: true, data: result });
  })
);
```

3. **Update Configuration** (`backend/src/services/ai/config.ts`):
```typescript
export const aiConfig = {
  features: {
    newFeature: {
      enabled: process.env.AI_FEATURE_NEW === 'true',
      model: 'claude-sonnet-4.5',
      maxRetries: 3
    }
  }
};
```

### Environment Configuration

**Backend** (`backend/.env`):
```env
# Server
NODE_ENV=development
PORT=3000
HOST=localhost

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/testops

# Authentication
JWT_SECRET=your-secret-key-min-32-characters
JWT_REFRESH_SECRET=your-refresh-secret-min-32-characters
JWT_EXPIRATION=24h
JWT_REFRESH_EXPIRATION=7d

# CORS
CORS_ORIGIN=http://localhost:5173

# Redis (optional)
REDIS_URL=redis://localhost:6379

# AI (optional)
AI_ENABLED=true
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
WEAVIATE_URL=http://localhost:8081

# Integrations (optional)
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-token
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

**Frontend** (`frontend/.env`):
```env
VITE_API_URL=http://localhost:3000/api/v1
VITE_WS_URL=ws://localhost:3000
```

---

## Testing Guidelines

### Backend Testing (Jest)

**Test Structure**:
```typescript
// backend/src/services/__tests__/testRun.service.test.ts
import { TestRunService } from '../testRun.service';
import { PrismaClient } from '@prisma/client';
import { NotFoundError } from '@/types/error';

jest.mock('@prisma/client');

describe('TestRunService', () => {
  let service: TestRunService;
  let prisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    service = new TestRunService();
    prisma = service['prisma'] as jest.Mocked<PrismaClient>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getTestRunById', () => {
    it('should return test run when found', async () => {
      const mockTestRun = { id: '1', name: 'Test' };
      prisma.testRun.findUnique.mockResolvedValue(mockTestRun);

      const result = await service.getTestRunById('1', 'user1');

      expect(result).toEqual(mockTestRun);
      expect(prisma.testRun.findUnique).toHaveBeenCalledWith({
        where: { id: '1' }
      });
    });

    it('should throw NotFoundError when test run not found', async () => {
      prisma.testRun.findUnique.mockResolvedValue(null);

      await expect(service.getTestRunById('1', 'user1'))
        .rejects
        .toThrow(NotFoundError);
    });
  });
});
```

**Running Tests**:
```bash
cd backend
npm test                    # Run all tests
npm test -- --watch         # Watch mode
npm test -- --coverage      # With coverage
npm test -- testRun.service # Specific test file
```

### Frontend Testing (Vitest + Testing Library)

**Component Test**:
```typescript
// frontend/src/components/ConfirmDialog/ConfirmDialog.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmDialog } from './ConfirmDialog';
import { describe, it, expect, vi } from 'vitest';

describe('ConfirmDialog', () => {
  const defaultProps = {
    open: true,
    title: 'Confirm Action',
    message: 'Are you sure?',
    onConfirm: vi.fn(),
    onCancel: vi.fn()
  };

  it('renders with title and message', () => {
    render(<ConfirmDialog {...defaultProps} />);

    expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('calls onConfirm when confirm button clicked', () => {
    render(<ConfirmDialog {...defaultProps} />);

    fireEvent.click(screen.getByText('Confirm'));

    expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when cancel button clicked', () => {
    render(<ConfirmDialog {...defaultProps} />);

    fireEvent.click(screen.getByText('Cancel'));

    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });
});
```

**Running Tests**:
```bash
cd frontend
npm test                    # Run all tests
npm test -- --watch         # Watch mode
npm test -- --coverage      # With coverage
npm test -- --ui            # UI mode
```

### E2E Testing (Playwright)

**Test Structure**:
```typescript
// tests/e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should login successfully', async ({ page }) => {
    await page.goto('http://localhost:5173/login');

    await page.fill('input[name="email"]', 'demo@testops.ai');
    await page.fill('input[name="password"]', 'demo123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });

  test('should show error on invalid credentials', async ({ page }) => {
    await page.goto('http://localhost:5173/login');

    await page.fill('input[name="email"]', 'wrong@email.com');
    await page.fill('input[name="password"]', 'wrongpass');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=Invalid credentials')).toBeVisible();
  });
});
```

**Running E2E Tests**:
```bash
npm run test:e2e           # Run E2E tests
npm run test:e2e:ui        # Interactive UI mode
```

---

## Git Workflow

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `refactor/description` - Code refactoring
- `docs/description` - Documentation
- `test/description` - Test additions
- `chore/description` - Maintenance tasks

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Test additions or changes
- `chore`: Build process or tooling changes
- `perf`: Performance improvements

**Examples**:
```
feat(auth): add refresh token rotation

Implement automatic token rotation on refresh to improve security.
Tokens now expire after 7 days instead of being permanent.

Closes #123
```

```
fix(api): handle null values in test results

Fixed crash when test results contain null values in metadata field.
Added validation to ensure metadata is always an object.
```

### Pull Request Process

1. **Create Feature Branch**:
```bash
git checkout -b feature/amazing-feature
```

2. **Make Changes and Commit**:
```bash
git add .
git commit -m "feat: add amazing feature"
```

3. **Push to Remote**:
```bash
git push origin feature/amazing-feature
```

4. **Create Pull Request**:
   - Clear description of changes
   - Reference related issues
   - Include screenshots for UI changes
   - Ensure CI passes

5. **Code Review**:
   - Address review comments
   - Keep commits clean and focused

6. **Merge**:
   - Squash commits if needed
   - Delete branch after merge

### Pre-commit Hooks

**Husky** runs linting before commits:

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md}": ["prettier --write"]
  }
}
```

---

## Integration Patterns

### Jira Integration

**Service Implementation**:
```typescript
// backend/src/services/jira.service.ts
export class JiraService {
  private baseUrl: string;
  private auth: string;

  constructor() {
    this.baseUrl = process.env.JIRA_BASE_URL || '';
    this.auth = Buffer.from(
      `${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`
    ).toString('base64');
  }

  async createIssue(data: CreateJiraIssueDTO): Promise<JiraIssue> {
    const response = await axios.post(
      `${this.baseUrl}/rest/api/3/issue`,
      {
        fields: {
          project: { key: data.projectKey },
          summary: data.summary,
          description: data.description,
          issuetype: { name: data.issueType || 'Bug' }
        }
      },
      {
        headers: {
          Authorization: `Basic ${this.auth}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  }
}
```

### Slack Notifications

**Service Implementation**:
```typescript
// backend/src/services/slack.service.ts
export class SlackService {
  private webhookUrl: string;

  constructor() {
    this.webhookUrl = process.env.SLACK_WEBHOOK_URL || '';
  }

  async sendNotification(message: SlackMessage): Promise<void> {
    await axios.post(this.webhookUrl, {
      text: message.text,
      blocks: message.blocks,
      attachments: message.attachments
    });
  }

  async notifyTestFailure(testRun: TestRun): Promise<void> {
    await this.sendNotification({
      text: `Test Run Failed: ${testRun.name}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Test Run Failed*\n*Pipeline:* ${testRun.pipeline.name}\n*Branch:* ${testRun.branch}`
          }
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'View Details' },
              url: `${process.env.FRONTEND_URL}/test-runs/${testRun.id}`
            }
          ]
        }
      ]
    });
  }
}
```

---

## AI-Specific Guidance

### Working with AI Services

**Key Principles**:
1. All AI calls should be tracked for cost monitoring
2. Use caching to reduce API costs (up to 80% savings)
3. Implement retries with exponential backoff
4. Set appropriate timeouts
5. Handle provider failures gracefully

**Best Practices**:

```typescript
// ✅ Good: Use AIManager for all AI operations
import { getAIManager } from '@/services/ai/manager';

const aiManager = getAIManager();
const result = await aiManager.categorizeFailure(failureData);

// ❌ Bad: Direct provider calls bypass tracking
const anthropic = new Anthropic({ apiKey: '...' });
const result = await anthropic.messages.create(...);
```

### Provider Selection

**When to use each provider**:

- **Anthropic Claude Sonnet 4.5**: Best for complex analysis, high quality
- **OpenAI GPT-4 Turbo**: Good balance of quality and speed
- **Google Gemini Flash**: Ultra-cheap, good for high-volume simple tasks
- **Azure OpenAI**: Enterprise SLAs, compliance requirements

### Cost Management

**Monitor costs**:
```typescript
// Get cost summary
const costs = await aiManager.getCostSummary(startDate, endDate);

// Set budget alerts
await aiManager.setBudgetAlert({
  threshold: 100, // dollars
  period: 'monthly',
  notifyEmail: 'team@example.com'
});
```

### Vector Database (Weaviate)

**Schema Design**:
```typescript
// Define schema for new vector collection
const schema = {
  class: 'FailureVector',
  vectorizer: 'none', // We provide embeddings
  properties: [
    { name: 'failureId', dataType: ['string'] },
    { name: 'errorMessage', dataType: ['text'] },
    { name: 'stackTrace', dataType: ['text'] },
    { name: 'category', dataType: ['string'] }
  ]
};
```

**Semantic Search**:
```typescript
// Search for similar failures
const embedding = await aiManager.embed(errorMessage);

const results = await weaviateClient.search(
  'FailureVector',
  embedding,
  {
    limit: 5,
    certainty: 0.7
  }
);
```

---

## Troubleshooting

### Common Issues

#### Database Connection Errors

**Problem**: `Error: Can't reach database server`

**Solutions**:
1. Check PostgreSQL is running: `docker-compose ps`
2. Verify DATABASE_URL in `.env`
3. Check database credentials
4. Run `docker-compose up -d db`

#### Prisma Client Not Generated

**Problem**: `Cannot find module '@prisma/client'`

**Solution**:
```bash
cd backend
npx prisma generate
```

#### Port Already in Use

**Problem**: `Error: listen EADDRINUSE: address already in use :::3000`

**Solution**:
```bash
# Find process using port
lsof -i :3000

# Kill process
kill -9 <PID>

# Or change port in backend/.env
PORT=3001
```

#### Frontend Build Failures

**Problem**: Type errors or build failures

**Solutions**:
1. Delete node_modules: `rm -rf node_modules && npm install`
2. Clear Vite cache: `rm -rf frontend/.vite`
3. Check TypeScript errors: `npm run typecheck:frontend`

#### AI Features Not Working

**Problem**: AI endpoints return errors

**Solutions**:
1. Check AI_ENABLED=true in backend/.env
2. Verify API key is set (ANTHROPIC_API_KEY, etc.)
3. Check Weaviate is running: `docker-compose ps weaviate`
4. Review logs: `cd backend && npm run dev` (check console)

#### Authentication Failures

**Problem**: 401 Unauthorized errors

**Solutions**:
1. Clear localStorage: `localStorage.clear()` in browser console
2. Check JWT secrets are set in backend/.env
3. Verify token hasn't expired
4. Re-login to get fresh token

### Debug Mode

**Enable Debug Logging**:

Backend:
```env
# backend/.env
LOG_LEVEL=debug
NODE_ENV=development
```

Frontend:
```typescript
// Enable React Query dev tools
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

<QueryClientProvider client={queryClient}>
  <App />
  <ReactQueryDevtools initialIsOpen={false} />
</QueryClientProvider>
```

### Performance Issues

**Backend**:
1. Check database query performance: Enable Prisma query logging
2. Monitor API response times
3. Check Redis cache hit rate
4. Review AI cache effectiveness

**Frontend**:
1. Use React DevTools Profiler
2. Check bundle size: `npm run build -- --analyze`
3. Monitor React Query cache
4. Check for unnecessary re-renders

---

## Best Practices Summary

### For Backend Development

✅ **DO**:
- Use service layer for business logic
- Throw custom error classes
- Validate inputs with Zod schemas
- Use Prisma transactions for multi-step operations
- Log important events with appropriate levels
- Use async/await consistently
- Add JSDoc comments for public APIs
- Track AI costs for all AI operations

❌ **DON'T**:
- Put business logic in controllers
- Use generic Error class
- Skip input validation
- Make direct database calls from controllers
- Use console.log (use winston logger)
- Mix callback and promise patterns
- Leave functions undocumented
- Call AI providers directly

### For Frontend Development

✅ **DO**:
- Use functional components with hooks
- Use React Query for server state
- Define TypeScript interfaces for props
- Use Material-UI components consistently
- Handle loading and error states
- Clean up subscriptions/intervals
- Use proper semantic HTML

❌ **DON'T**:
- Use class components
- Mix state management approaches
- Use `any` type
- Create custom UI components for standard elements
- Ignore loading/error states
- Create memory leaks
- Use divs for everything

### For Testing

✅ **DO**:
- Write tests for new features
- Test error cases
- Mock external dependencies
- Use meaningful test descriptions
- Clean up after tests
- Test user interactions

❌ **DON'T**:
- Skip tests for "simple" code
- Only test happy paths
- Test implementation details
- Use vague test names
- Leave test data in database
- Test only isolated units (also test integration)

---

## Additional Resources

### Documentation

- [API Reference](docs/api/README.md)
- [Integration Guides](docs/integrations/)
- [Failure Knowledge Base Guide](docs/features/FAILURE_KNOWLEDGE_BASE.md)
- [Demo Guide](DEMO.md)
- [Beta Program](BETA.md)

### External Resources

- [Prisma Docs](https://www.prisma.io/docs)
- [Express.js Guide](https://expressjs.com/en/guide/)
- [React Documentation](https://react.dev/)
- [Material-UI Docs](https://mui.com/material-ui/)
- [React Query Docs](https://tanstack.com/query/latest)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

### Getting Help

- **Issues**: [GitHub Issues](https://github.com/rayalon1984/testops-companion/issues)
- **Discussions**: [GitHub Discussions](https://github.com/rayalon1984/testops-companion/discussions)
- **Beta Program**: [Apply for early access](https://forms.gle/dmeKzseAbhPA6KLq8)

---

## Changelog

### 2026-01-04
- Initial CLAUDE.md creation
- Comprehensive architecture documentation
- Development workflow guidelines
- Testing and integration patterns

---

**This guide is maintained by the TestOps Companion team. Last updated: 2026-01-04**
