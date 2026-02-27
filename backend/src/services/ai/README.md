# AI Services

This directory contains AI-powered features for TestOps Copilot.

## Structure

```
ai/
├── types.ts              # TypeScript interfaces and types
├── config.ts             # Configuration management
├── manager.ts            # AI Service Manager (main orchestrator)
├── cache.ts              # Caching layer
├── cost-tracker.ts       # Cost tracking
├── redactor.ts           # Data redaction for privacy
│
├── providers/            # AI Provider implementations
│   ├── base.provider.ts
│   ├── anthropic.provider.ts
│   ├── openai.provider.ts
│   ├── google.provider.ts
│   ├── azure.provider.ts
│   └── registry.ts
│
├── features/             # AI-powered features
│   ├── rca-matching.ts
│   ├── categorization.ts
│   ├── log-summary.ts
│   ├── nl-query.ts
│   └── ticket-generation.ts
│
└── vector/               # Vector database integration
    ├── client.ts
    ├── schema.ts
    └── search.ts
```

## Status

**Phase 1 - RCA Matching** ✅ Complete (v2.5.3)
- [x] TypeScript interfaces
- [x] Configuration files
- [x] Base provider implementation
- [x] Provider registry (Anthropic, OpenAI)
- [x] AI Service Manager
- [x] Vector database integration (Weaviate)
- [x] RCA matching feature
- [x] Cost tracking and caching
- [x] Tests

**Phase 2 - Advanced Features** ✅ Complete (v2.5.4)
- [x] Google Gemini provider
- [x] Azure OpenAI provider
- [x] Automated failure categorization
- [x] Log summarization
- [x] API endpoints for all features
- [x] CLI commands
- [x] Comprehensive testing

## Getting Started

### Prerequisites

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env and add your AI provider API keys
   ```

3. Configure AI features:
   ```bash
   cp config/ai.example.yml config/ai.yml
   # Edit config/ai.yml
   ```

4. Start Vector Database:
   ```bash
   docker-compose up -d weaviate
   ```

### Configuration

See [config/ai.example.yml](../../../config/ai.example.yml) for all available options.

Key settings:
- `ai.enabled` - Enable/disable AI features
- `ai.provider` - Choose provider (anthropic/openai/google/azure)
- `ai.model` - Model to use
- `ai.cost.monthly_budget_usd` - Monthly spending limit

### Environment Variables

Required variables depend on your chosen provider:

**Anthropic:**
```bash
ANTHROPIC_API_KEY=sk-ant-xxxxx
VOYAGE_API_KEY=pa-xxxxx  # For embeddings
```

**OpenAI:**
```bash
OPENAI_API_KEY=sk-xxxxx
```

**Google Gemini:**
```bash
GOOGLE_API_KEY=xxxxx
```

**Azure OpenAI:**
```bash
AZURE_OPENAI_ENDPOINT=https://xxxxx.openai.azure.com
AZURE_OPENAI_KEY=xxxxx
```

## Development

### Adding a New Provider

1. Create `src/services/ai/providers/your-provider.provider.ts`
2. Extend `BaseProvider` class
3. Implement required methods
4. Register in `providers/registry.ts`
5. Add tests

### Adding a New Feature

1. Create `src/services/ai/features/your-feature.ts`
2. Use `aiService.chat()` or `aiService.embed()` for AI calls
3. Add REST API endpoint in `src/api/routes/ai/`
4. Add CLI command in `src/cli/commands/ai/`
5. Add tests

## Testing

```bash
# Unit tests
npm test -- tests/ai/unit/

# Integration tests
npm test -- tests/ai/integration/

# E2E tests
npm test -- tests/ai/e2e/
```

## Cost Tracking

AI usage costs are tracked automatically:
- View costs: `npm run ai:costs`
- Budget alerts at 80% threshold
- Monthly limits enforced

## Security

- All sensitive data is redacted before sending to AI
- API keys stored in environment variables
- Audit logs for all AI requests
- GDPR compliant

## Documentation

- [AI Integration PRD](../../../docs/specs/ai-integration/PRD.md)
- [Architecture](../../../docs/specs/ai-integration/ARCHITECTURE.md)
- [API Reference](../../../docs/specs/ai-integration/API.md)
- [Implementation Plan](../../../docs/specs/ai-integration/IMPLEMENTATION_PLAN.md)

## Next Steps

1. **Phase 1** - Smart RCA Matching (Week 3-5)
2. **Phase 2** - Failure Categorization (Week 6-7)
3. **Phase 3** - Log Summarization (Week 8-9)
4. **Phase 4** - Advanced Features (Week 10-12)

See [Implementation Plan](../../../docs/specs/ai-integration/IMPLEMENTATION_PLAN.md) for details.
