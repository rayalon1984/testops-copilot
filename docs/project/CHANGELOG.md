# Changelog

All notable changes to TestOps Companion will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.5.3] - 2025-11-20

### Added
- **AI Integration - Phase 1**: Complete AI-powered test failure analysis infrastructure
  - **Provider Abstraction Layer**: Support for multiple AI providers (Anthropic Claude, OpenAI GPT-4)
    - BaseProvider abstract class with unified interface
    - AnthropicProvider with Claude Sonnet 4.5 support
    - OpenAIProvider with GPT-4 Turbo and GPT-3.5 support
    - Provider registry with automatic detection from environment variables
    - Cost calculation, token estimation, and health checks
  - **Vector Database Integration**: Weaviate for semantic search
    - Full CRUD operations for test failure embeddings
    - Semantic similarity search with configurable thresholds
    - Schema management for TestFailure and LogSummary collections
    - Batch operations and advanced filtering
    - Statistics and cleanup operations
  - **RCA (Root Cause Analysis) Matching**: AI-powered failure analysis
    - Automatic embedding generation for test failures
    - Semantic search across historical failures
    - AI-enhanced explanations of failure similarity
    - Resolution tracking for knowledge building
    - Configurable similarity thresholds and filters
  - **Configuration Management**: Flexible configuration system
    - YAML configuration file support (config/ai.yml)
    - Environment variable overrides
    - Feature flags for gradual rollout
    - Configuration validation and error reporting
  - **Caching Layer**: 3-tier Redis-based caching
    - Response cache for full AI responses
    - Embedding cache for computed embeddings
    - Summary cache for log summaries
    - Cache hit rate tracking and statistics
    - Configurable TTL (default: 7 days)
  - **Cost Tracking**: PostgreSQL-based usage monitoring
    - Track AI usage by provider, model, and feature
    - Budget alerts and threshold monitoring (default: 80% of $100/month)
    - Monthly cost summaries and projections
    - Top cost driver analysis
    - Cache hit rate impact on costs
  - **AI Service Manager**: Central orchestration
    - Initialize and manage all AI services
    - Health monitoring across components
    - Feature-gated access control
    - Graceful initialization and shutdown
  - **REST API Endpoints**: Full AI feature access via REST
    - `POST /api/ai/rca/similar` - Find similar failures
    - `POST /api/ai/rca/store` - Store failure for future matching
    - `PUT /api/ai/rca/:id/resolve` - Mark failure as resolved
    - `GET /api/ai/costs` - Cost summary and usage statistics
    - `GET /api/ai/stats` - Overall AI statistics
    - `GET /api/ai/health` - Health check for all AI services
  - **CLI Commands**: Command-line AI tools
    - `testops ai health` - Check AI services health
    - `testops ai costs` - View cost summary with date filtering
    - `testops ai stats` - View overall statistics
    - `testops ai rca <test-id>` - Find similar failures with options
  - **Testing Infrastructure**: Comprehensive test coverage
    - Unit tests for providers and configuration
    - Integration tests for RCA matching workflow
    - Test coverage for cost tracking and caching

### Dependencies
- Added `@anthropic-ai/sdk` ^0.70.0 - Anthropic Claude SDK
- Added `openai` ^6.9.1 - OpenAI GPT SDK
- Added `@google/generative-ai` ^0.24.1 - Google Gemini SDK (for future Phase 2)
- Added `@azure/openai` ^2.0.0 - Azure OpenAI SDK (for future Phase 2)
- Added `weaviate-ts-client` ^2.2.0 - Weaviate vector database client
- Added `js-yaml` - YAML configuration parsing
- Added `zod`, `p-queue`, `p-retry`, `bull`, `ioredis` - Supporting libraries

### Documentation
- Added comprehensive AI service documentation in `src/services/ai/README.md`
- Added testing guide in `tests/ai/README.md`
- Updated main exports in `src/services/ai/index.ts`
- Created example configuration files (`.env.example`, `config/ai.example.yml`)

### Infrastructure
- Updated `docker-compose.yml` with Weaviate service on port 8081
- Database schema for AI usage tracking
- Redis integration for caching

### Technical Details
- **File Structure**: Organized AI services in `src/services/ai/` with clear separation:
  - `providers/` - AI provider implementations
  - `vector/` - Vector database operations
  - `features/` - AI-powered features (RCA matching, categorization, etc.)
  - Configuration, caching, cost tracking, and manager at root level
- **Provider Pricing**: Accurate cost tracking for Claude Sonnet 4.5 ($3/M input, $15/M output) and GPT-4 Turbo ($10/M input, $30/M output)
- **Rate Limits**: Configurable per-minute and per-day limits (default: 100/min, 10,000/day)
- **Embedding Models**: Support for provider-specific embeddings (OpenAI text-embedding-3-small, Voyage AI for Anthropic)

### Coming in Phase 2
- Automated failure categorization (Bug/Environment/Flaky)
- Log summarization with AI
- Google Gemini provider implementation
- Azure OpenAI provider implementation
- Natural language queries over test data
- Intelligent ticket generation

## [2.5.2] - 2025-11-17

### Added
- **Confluence Integration**: Automated documentation publishing to Atlassian Confluence
  - Publish Root Cause Analysis documents from Failure Knowledge Base to Confluence
  - Generate automated test execution reports with statistics and failure details
  - Link Confluence pages to Jira issues for complete traceability
  - Organize documentation with spaces, parent pages, and labels
  - Track publishing history and automatically update existing pages
  - ConfluenceService with full REST API v2 support
  - Database models for Confluence configuration, page tracking, and publish logs
  - Environment variable configuration for Confluence credentials
  - Support for custom spaces and parent page organization

### Documentation
- Added comprehensive Confluence integration guide (`docs/integrations/confluence.md`)
- Updated README with Confluence integration section
- Added Confluence configuration to environment examples
- Included API reference and usage examples for Confluence publishing

### Backend
- Confluence service implementation with Basic authentication
- Confluence types and interfaces for type-safe integration
- Database schema updates for Confluence models (Config, Page, PublishLog)
- Configuration support for Confluence credentials and settings
- RCA document publishing with rich HTML formatting
- Test report publishing with customizable detail levels

## [2.5.1] - 2025-11-17

### Added
- **TestRail Integration**: Complete test case management integration
  - Automatic test run creation in TestRail from CI/CD executions
  - Bi-directional test result synchronization
  - Support for test suites, milestones, and projects
  - Test case mapping between TestOps Companion and TestRail
  - Comprehensive TestRail integration guide with API documentation
  - TestRailService with full API support (runs, results, cases, projects)
  - Database models for TestRail configuration and run mapping
  - Environment variable configuration for TestRail credentials

### Documentation
- Added complete TestRail integration guide (`docs/integrations/testrail.md`)
- Updated README with TestRail integration section
- Added TestRail configuration to environment examples
- Included API reference and usage examples for TestRail

### Backend
- TestRail service implementation with authentication and API client
- TestRail types and interfaces for type-safe integration
- Database schema updates for TestRail models (Config, Run, Sync)
- Configuration support for TestRail credentials and settings

## [2.5.0] - 2025-11-16

### Added
- Grafana & Prometheus integration for metrics visualization and monitoring
- Prometheus metrics exporter with 20+ test metrics at `/metrics` endpoint
- Pre-built Grafana dashboard with 7 visualization panels
- Comprehensive Grafana integration guide with setup and alerting examples
- MetricsService for collecting test run statistics and failure analytics
- MetricsController with JSON and Prometheus format endpoints
- Monday.com Work OS integration for work item management
- Failure Knowledge Base with intelligent failure matching
- Root Cause Analysis (RCA) documentation system
- Similar failure detection using smart fingerprinting
- Knowledge retention across team changes
- Demo and screenshots guide with visual mockups
- Comprehensive architecture documentation updates
- Apache License 2.0 migration

### Backend
- Metrics endpoints: `/metrics` (Prometheus), `/api/v1/metrics/*` (JSON)
- Test metrics tracking: pass rates, execution times, failure statistics
- RCA coverage metrics and integration analytics
- Failure archive with similarity matching
- Monday.com API integration
- Jira integration for ticket creation
- Enhanced notification system

### Monitoring & Observability
- Real-time test metrics in Prometheus format
- Grafana dashboards for test health visualization
- Metrics for pass/fail rates, flaky tests, execution time percentiles
- RCA documentation coverage tracking
- Integration metrics (Jira, Monday.com, notifications)
- Alerting support for failure rate spikes and performance degradation

### Documentation
- Complete Grafana integration guide (500+ lines)
- Failure Knowledge Base feature documentation
- Monday.com integration guide
- Jira integration guide
- Updated architecture documentation
- Demo guide with visual mockups
- Quickstart guide improvements

## [2.5.0] - 2025-11-16

### Added
- **Grafana & Prometheus Integration**: Complete monitoring and metrics visualization
  - Prometheus metrics exporter at `/metrics` endpoint
  - 20+ test metrics: pass rates, execution times, failure statistics, RCA coverage
  - Pre-built Grafana dashboard with 7 panels (pass rate gauge, test trends, execution time percentiles)
  - JSON API endpoints at `/api/v1/metrics/*` for custom dashboards
  - Comprehensive 500+ line integration guide with Prometheus/Grafana setup
  - Alerting configuration examples for failure spikes and performance degradation
  - MetricsService and MetricsController implementation

- **Monday.com Work OS Integration**: Work item management and tracking
  - Create Monday.com items automatically from test failures
  - Bi-directional sync with test results
  - Custom board and column configuration
  - Integration guide with API setup instructions

- **Failure Knowledge Base**: Intelligent failure documentation and matching
  - Root Cause Analysis (RCA) documentation system
  - Smart failure fingerprinting and similarity matching
  - Automatic detection of recurring issues
  - 95% faster resolution time for known failures
  - Knowledge retention across team changes
  - Comprehensive feature documentation

### Changed
- Updated architecture documentation with new integrations
- Enhanced README with Grafana, Monday.com, and Failure Knowledge Base features
- Improved monitoring guide with actual implementation examples

### Documentation
- Added complete Grafana integration guide (`docs/integrations/grafana.md`)
- Added Monday.com integration guide (`docs/integrations/monday.md`)
- Added Failure Knowledge Base documentation (`docs/features/FAILURE_KNOWLEDGE_BASE.md`)
- Added demo guide with visual mockups (`DEMO.md`)
- Updated architecture documentation with Monitoring & Observability section

## [1.0.0] - 2024-12-01

### Added
- User authentication and authorization with JWT
- Pipeline management and execution
- Test run tracking and reporting
- Real-time notification system
- Interactive dashboard with analytics
- Test result visualization
- Pipeline scheduling capabilities
- CI/CD system integrations (Jenkins, GitHub Actions)
- Email notifications
- Slack notifications
- Pushover notifications
- Jira integration for issue tracking
- User preferences and settings
- Comprehensive API documentation
- Security features (rate limiting, helmet, CORS)
- Database migrations with Prisma
- Logging system with Winston
- Performance monitoring
- Error tracking and handling

### Backend Features
- Express.js server with TypeScript
- PostgreSQL database with Prisma ORM
- JWT authentication system
- Role-based access control (RBAC)
- API rate limiting
- Request/response logging
- Security headers
- Environment-based configuration

### Frontend Features
- React application with TypeScript
- Material-UI component library
- React Query for data fetching
- React Router for navigation
- Authentication context and protected routes
- Form validation
- Error boundaries
- Responsive design

### Testing
- Backend unit tests with Jest
- Frontend unit tests
- Integration test suite
- E2E tests with Cypress
- Test coverage reporting
- Performance testing setup

### Documentation
- API reference documentation
- Architecture documentation
- Development guide
- Deployment guide
- Security guide
- Testing guide
- Performance optimization guide
- Troubleshooting guide
- Database schema documentation
- Quick start guide

## Version History Template

## [X.Y.Z] - YYYY-MM-DD

### Added
- New features
- New functionality
- New components
- New integrations

### Changed
- Updates to existing features
- Dependency updates
- Performance improvements
- UI/UX improvements

### Deprecated
- Soon-to-be removed features
- Deprecated functionality
- Migration guides

### Removed
- Removed features
- Discontinued functionality
- Breaking changes

### Fixed
- Bug fixes
- Error corrections
- Performance fixes
- Security fixes

### Security
- Security updates
- Vulnerability fixes
- Security improvements

## Commit Message Format

Format: `<type>(<scope>): <subject>`

### Types
- feat: A new feature
- fix: A bug fix
- docs: Documentation only changes
- style: Changes that do not affect the meaning of the code
- refactor: A code change that neither fixes a bug nor adds a feature
- perf: A code change that improves performance
- test: Adding missing tests or correcting existing tests
- chore: Changes to the build process or auxiliary tools

### Scopes
- auth: Authentication related changes
- pipeline: Pipeline management changes
- test: Test execution related changes
- notification: Notification system changes
- ui: User interface changes
- api: API related changes
- db: Database related changes
- docs: Documentation changes
- ci: CI configuration changes
- deps: Dependency updates

### Examples
```
feat(pipeline): add support for GitHub Actions integration
fix(auth): resolve token refresh issue
docs(api): update API documentation
style(ui): improve dashboard layout
refactor(db): optimize database queries
perf(api): add response caching
test(pipeline): add integration tests
chore(deps): update dependencies
```

## Release Process

1. Version Bump
```bash
npm version <major|minor|patch>
```

2. Update Changelog
- Add new version section
- Document all changes
- Update links

3. Create Release
```bash
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z
```

4. Deploy
- Run tests
- Build artifacts
- Deploy to staging
- Verify changes
- Deploy to production

5. Announce
- Update documentation
- Notify users
- Post release notes

## Migration Guides

When breaking changes are introduced, migration guides will be provided here to help users upgrade their applications.

[Unreleased]: https://github.com/yourusername/testops-companion/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/yourusername/testops-companion/releases/tag/v1.0.0