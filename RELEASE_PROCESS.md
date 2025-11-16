# Release Process

This document outlines the release process for TestOps Companion to ensure consistency and professional presentation for potential employers and users.

## Overview

TestOps Companion follows [Semantic Versioning](https://semver.org/):
- **MAJOR** version (X.0.0): Incompatible API changes
- **MINOR** version (0.X.0): New functionality in a backward compatible manner
- **PATCH** version (0.0.X): Backward compatible bug fixes

## Current Version

**Latest Release:** v1.1.0 (2025-11-16)

## Release Checklist

### 1. Pre-Release Preparation

- [ ] **Update CHANGELOG.md**
  - Move all items from `[Unreleased]` section to new version section
  - Add release date in format: `## [X.Y.Z] - YYYY-MM-DD`
  - Ensure all changes are categorized (Added, Changed, Fixed, etc.)
  - Add descriptive details for each change

- [ ] **Update Version Numbers**
  - Update `package.json` version
  - Update `backend/package.json` version
  - Ensure both match the release version

- [ ] **Run Quality Checks**
  ```bash
  npm run lint
  npm run typecheck
  npm run test
  npm run build
  ```

- [ ] **Update Documentation**
  - Verify README.md reflects latest features
  - Ensure integration guides are up to date
  - Update any version-specific documentation

### 2. Create Release

#### Option A: Automated Release (Recommended)

1. **Create and Push Git Tag**
   ```bash
   # Ensure you're on main branch
   git checkout main
   git pull origin main

   # Create annotated tag
   git tag -a v1.1.0 -m "Release version 1.1.0

   ## Highlights
   - Grafana & Prometheus Integration
   - Monday.com Work OS Integration
   - Failure Knowledge Base

   See CHANGELOG.md for full details."

   # Push tag to trigger release workflow
   git push origin v1.1.0
   ```

2. **Monitor GitHub Actions**
   - Go to Actions tab in GitHub
   - Watch the "Release" workflow execute
   - Verify Docker images are built and pushed
   - Verify GitHub Release is created

3. **Edit GitHub Release Notes**
   - Go to Releases page
   - Click "Edit" on the new release
   - Use the template below to enhance release notes

#### Option B: Manual Release

1. **Create Tag Locally**
   ```bash
   git tag -a v1.1.0 -m "Release v1.1.0"
   git push origin v1.1.0
   ```

2. **Create GitHub Release Manually**
   - Go to GitHub → Releases → "Draft a new release"
   - Select the tag you just created
   - Use the release notes template (see below)
   - Attach any artifacts if needed
   - Publish release

### 3. Post-Release Tasks

- [ ] **Verify Release Artifacts**
  - Check Docker images are available: `docker pull ghcr.io/rayalon1984/testops-companion/backend:1.1.0`
  - Verify release page displays correctly
  - Test documentation links

- [ ] **Update CHANGELOG for Next Development**
  - Add new `[Unreleased]` section at top of CHANGELOG.md
  - Prepare for next version's changes

- [ ] **Announce Release** (if public)
  - Update project README if needed
  - Post on relevant channels (Twitter, LinkedIn, etc.)
  - Update any external documentation

- [ ] **Create Next Milestone**
  - On GitHub, create milestone for next version
  - Move any incomplete issues to new milestone

## Release Notes Template

Use this template when creating/editing GitHub releases:

```markdown
## 🎉 TestOps Companion v1.1.0

**Release Date:** November 16, 2025

### 🌟 Highlights

Brief summary of the most important changes in this release.

### ✨ What's New

#### Grafana & Prometheus Integration
- Prometheus metrics exporter with 20+ test metrics
- Pre-built Grafana dashboard with 7 visualization panels
- Real-time monitoring of test health and performance
- [Complete Integration Guide](docs/integrations/grafana.md)

#### Monday.com Work OS Integration
- Automatic work item creation from test failures
- Bi-directional sync with test results
- Custom board and column configuration
- [Integration Documentation](docs/integrations/monday.md)

#### Failure Knowledge Base
- Intelligent failure matching and documentation
- Root Cause Analysis (RCA) system
- 95% faster resolution for known issues
- Smart failure fingerprinting

### 🔧 Improvements

- Updated architecture documentation
- Enhanced monitoring capabilities
- Improved type safety in backend

### 📚 Documentation

- Complete Grafana integration guide (500+ lines)
- Monday.com integration documentation
- Failure Knowledge Base feature guide
- Updated README and architecture docs

### 🐛 Bug Fixes

- Fixed TypeScript compilation errors
- Resolved Mermaid diagram rendering issues
- Corrected router type annotations

### 📦 Installation

```bash
# Clone the repository
git clone https://github.com/rayalon1984/testops-companion.git
cd testops-companion

# Checkout this version
git checkout v1.1.0

# Install and setup
npm run setup
```

### 🐳 Docker Images

```bash
docker pull ghcr.io/rayalon1984/testops-companion/backend:1.1.0
docker pull ghcr.io/rayalon1984/testops-companion/frontend:1.1.0
```

### 📖 Full Changelog

See [CHANGELOG.md](CHANGELOG.md) for complete details.

### 🙏 Contributors

Thanks to everyone who contributed to this release!

---

**Previous Release:** [v1.0.0](https://github.com/rayalon1984/testops-companion/releases/tag/v1.0.0)
**Next Release:** [v1.2.0 Roadmap](ROADMAP.md)
```

## Version History

| Version | Date | Highlights |
|---------|------|------------|
| 1.1.0 | 2025-11-16 | Grafana integration, Monday.com, Failure Knowledge Base |
| 1.0.0 | 2024-12-01 | Initial stable release |
| 0.4.5 | 2024-11-XX | Beta release |

## Automation

### GitHub Actions Workflow

The release process is automated via `.github/workflows/release.yml`:

1. **Triggered by:** Git tags matching `v*` pattern
2. **Automatically:**
   - Creates GitHub Release
   - Builds Docker images
   - Pushes to GitHub Container Registry
   - Tags with version and `latest`
   - Deploys documentation

### Future Improvements

- [ ] Automated version bumping
- [ ] Automated CHANGELOG.md generation from conventional commits
- [ ] Release candidate (RC) builds
- [ ] Beta/Alpha release channels
- [ ] Automated npm package publishing
- [ ] Release announcements via GitHub Discussions

## Troubleshooting

### Release Workflow Failed

1. Check GitHub Actions logs
2. Common issues:
   - Missing secrets (GITHUB_TOKEN, SLACK_WEBHOOK_URL)
   - Docker build failures
   - Tag format incorrect (must be `vX.Y.Z`)

### Tag Already Exists

```bash
# Delete local tag
git tag -d v1.1.0

# Delete remote tag
git push origin :refs/tags/v1.1.0

# Recreate tag
git tag -a v1.1.0 -m "Release v1.1.0"
git push origin v1.1.0
```

### Version Mismatch

Ensure these files all have matching versions:
- `package.json`
- `backend/package.json`
- `CHANGELOG.md` latest entry
- Git tag

## Best Practices

1. **Never skip versions** - Follow semantic versioning strictly
2. **Always test before release** - Run full test suite
3. **Document everything** - Update CHANGELOG.md with every change
4. **Tag properly** - Use annotated tags with meaningful messages
5. **Verify releases** - Always check the release page after publishing
6. **Keep history clean** - Don't delete or modify published releases
7. **Be consistent** - Follow this process every time

## Contact

For questions about the release process:
- Open an issue with label `release`
- See [CONTRIBUTING.md](CONTRIBUTING.md)

---

**Last Updated:** 2025-11-16
**Maintained by:** Rotem Ayalon
