#!/bin/bash

# Version Bump Helper Script for TestOps Companion
# Usage: ./scripts/bump-version.sh <major|minor|patch> [--dry-run]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if version type is provided
if [ -z "$1" ]; then
  echo -e "${RED}Error: Please specify version bump type (major, minor, or patch)${NC}"
  echo "Usage: $0 <major|minor|patch> [--dry-run]"
  exit 1
fi

BUMP_TYPE=$1
DRY_RUN=false

if [ "$2" == "--dry-run" ]; then
  DRY_RUN=true
fi

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")

echo -e "${BLUE}Current version: ${CURRENT_VERSION}${NC}"

# Calculate new version
IFS='.' read -r -a VERSION_PARTS <<< "$CURRENT_VERSION"
MAJOR=${VERSION_PARTS[0]}
MINOR=${VERSION_PARTS[1]}
PATCH=${VERSION_PARTS[2]}

case $BUMP_TYPE in
  major)
    MAJOR=$((MAJOR + 1))
    MINOR=0
    PATCH=0
    ;;
  minor)
    MINOR=$((MINOR + 1))
    PATCH=0
    ;;
  patch)
    PATCH=$((PATCH + 1))
    ;;
  *)
    echo -e "${RED}Error: Invalid bump type. Use major, minor, or patch${NC}"
    exit 1
    ;;
esac

NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"

echo -e "${GREEN}New version will be: ${NEW_VERSION}${NC}"

if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}DRY RUN - No changes will be made${NC}"
  echo ""
  echo "Files that would be updated:"
  echo "  - package.json"
  echo "  - backend/package.json"
  echo "  - CHANGELOG.md (date will be added)"
  echo ""
  echo "To apply these changes, run without --dry-run flag"
  exit 0
fi

# Confirm with user
echo ""
read -p "Continue with version bump? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${YELLOW}Version bump cancelled${NC}"
  exit 0
fi

echo -e "${BLUE}Updating version numbers...${NC}"

# Update package.json
if command -v jq > /dev/null; then
  # Use jq if available
  jq ".version = \"${NEW_VERSION}\"" package.json > package.json.tmp && mv package.json.tmp package.json
  jq ".version = \"${NEW_VERSION}\"" backend/package.json > backend/package.json.tmp && mv backend/package.json.tmp backend/package.json
else
  # Fallback to sed
  sed -i.bak "s/\"version\": \"${CURRENT_VERSION}\"/\"version\": \"${NEW_VERSION}\"/" package.json
  sed -i.bak "s/\"version\": \"${CURRENT_VERSION}\"/\"version\": \"${NEW_VERSION}\"/" backend/package.json
  rm -f package.json.bak backend/package.json.bak
fi

# Update CHANGELOG.md with release date
CURRENT_DATE=$(date +%Y-%m-%d)
sed -i.bak "s/## \[${NEW_VERSION}\] - TBD/## [${NEW_VERSION}] - ${CURRENT_DATE}/" CHANGELOG.md || \
sed -i.bak "s/## \[Unreleased\]/## [${NEW_VERSION}] - ${CURRENT_DATE}\n\n## [Unreleased]/" CHANGELOG.md
rm -f CHANGELOG.md.bak

echo -e "${GREEN}✓ Version numbers updated${NC}"

# Check if there are uncommitted changes
if [[ -n $(git status -s) ]]; then
  echo -e "${YELLOW}Warning: You have uncommitted changes${NC}"
  echo "Please review and commit the version bump changes before creating a release."
  echo ""
  echo "Next steps:"
  echo "1. Review changes: git diff"
  echo "2. Commit: git add -A && git commit -m \"chore: bump version to v${NEW_VERSION}\""
  echo "3. Create tag: git tag -a v${NEW_VERSION} -m \"Release v${NEW_VERSION}\""
  echo "4. Push: git push origin main && git push origin v${NEW_VERSION}"
else
  echo -e "${GREEN}✓ Working directory is clean${NC}"

  # Offer to create git tag
  echo ""
  read -p "Create git tag v${NEW_VERSION}? (y/n) " -n 1 -r
  echo ""
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    git tag -a "v${NEW_VERSION}" -m "Release v${NEW_VERSION}"
    echo -e "${GREEN}✓ Git tag v${NEW_VERSION} created${NC}"
    echo ""
    echo "To publish the release, run:"
    echo "  git push origin main"
    echo "  git push origin v${NEW_VERSION}"
  fi
fi

echo ""
echo -e "${GREEN}Version bump complete!${NC}"
echo ""
echo "Summary:"
echo "  Old version: ${CURRENT_VERSION}"
echo "  New version: ${NEW_VERSION}"
echo "  Bump type: ${BUMP_TYPE}"
