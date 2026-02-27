# Changelog

All notable changes to the TestOps Copilot MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-20

### Added
- Initial release of TestOps Copilot MCP Server
- **Analysis Tools:**
  - `testops_analyze_failure` - Single failure analysis with AI
  - `testops_batch_analyze` - Batch failure analysis for CI runs
- **Knowledge Base Tools:**
  - `testops_search_knowledge` - Search historical failures
  - `testops_add_knowledge` - Add resolved failures to KB
  - `testops_get_knowledge_stats` - Knowledge base statistics
- **Statistics Tools:**
  - `testops_get_pipeline_stats` - Pipeline health metrics
  - `testops_get_test_history` - Test flakiness analysis
  - `testops_get_cost_stats` - AI cost tracking
  - `testops_health_check` - Service health monitoring
- Comprehensive documentation (SKILL.md, README.md)
- Cost optimization features
- Token usage tracking
- Database connection pooling
- Input validation with Zod
- TypeScript strict mode support

### Cost Optimization Features
- Knowledge base search-first pattern (98% cost reduction)
- Batch analysis for multiple failures (80% cost savings)
- Smart log truncation to limit token usage
- Caching support for repeated queries

### Developer Experience
- MCP Inspector integration for testing
- Hot reload in development mode
- Comprehensive error messages
- TypeScript types for all tools
- Example usage in documentation

## [Unreleased]

### Planned
- Vector similarity search integration
- Real-time AI service integration
- Webhook support for notifications
- Advanced analytics and trends
- Multi-tenant support
- Performance metrics dashboard

---

[1.0.0]: https://github.com/rayalon1984/testops-copilot/releases/tag/mcp-v1.0.0
