# Technical Specifications

This directory contains detailed technical specifications for major features and architectural decisions.

## Active Specifications

### [AI Integration](ai-integration/)
Complete specification for AI-powered features including semantic RCA matching, failure categorization, and log summarization.

**Documents:**
- [PRD.md](ai-integration/PRD.md) - Product Requirements Document
- [ARCHITECTURE.md](ai-integration/ARCHITECTURE.md) - Technical Architecture
- [API.md](ai-integration/API.md) - API Design & Interfaces
- [IMPLEMENTATION_PLAN.md](ai-integration/IMPLEMENTATION_PLAN.md) - Implementation Roadmap

**Status:** 📋 Approved - Ready for Implementation

---

## Creating New Specifications

When creating specifications for new features:

1. **Create a new directory** under `specs/` with the feature name (kebab-case)
2. **Include these documents:**
   - `PRD.md` - Product Requirements Document
   - `ARCHITECTURE.md` - Technical design
   - `API.md` - API contracts and interfaces
   - `IMPLEMENTATION_PLAN.md` - Development roadmap
3. **Update this README** with a link to the new spec
4. **Get review** from product and engineering leads

## Specification Template

```markdown
# Feature Name

## Overview
Brief description...

## Goals
- Goal 1
- Goal 2

## Non-Goals
What this feature does NOT cover...

## Technical Design
...

## Implementation Plan
...

## Success Metrics
...
```

## Archived Specifications

Specifications for completed features are moved to `archived/` directory.
