# Documentation Assets

This directory contains images, diagrams, and screenshots used in documentation.

## Directory Structure

```
assets/
├── images/         # General images
├── diagrams/       # Architecture and flow diagrams
└── screenshots/    # Application screenshots
```

---

## Guidelines

### Images
- **Format**: PNG or SVG preferred
- **Naming**: Use descriptive kebab-case names (e.g., `user-flow-diagram.png`)
- **Size**: Optimize images before committing (use tools like TinyPNG)
- **Max size**: 500KB per image

### Diagrams
- **Tools**: Use Mermaid, draw.io, or similar
- **Format**: SVG preferred, PNG acceptable
- **Source**: Keep source files (`.drawio`, `.mmd`) alongside exports
- **Naming**: `{feature}-{type}-diagram.svg` (e.g., `ai-architecture-diagram.svg`)

### Screenshots
- **Resolution**: 1400x1000 minimum for dashboard screenshots
- **Format**: PNG with transparency if needed
- **Naming**: `{feature}-{view}-screenshot.png`
- **Annotations**: Use red boxes/arrows for clarity
- **Privacy**: Ensure no sensitive data visible

---

## Examples

```
images/
├── logo.png
├── icon-512x512.png
└── banner.svg

diagrams/
├── system-architecture.svg
├── system-architecture.drawio
├── data-flow-diagram.svg
└── deployment-diagram.svg

screenshots/
├── dashboard-main-view.png
├── rca-matching-results.png
└── ai-categorization-panel.png
```

---

## Using Assets in Documentation

### Markdown
```markdown
![Alt text](./assets/images/logo.png)
```

### Relative Paths
From `docs/`:
```markdown
![Dashboard](./assets/screenshots/dashboard-main-view.png)
```

From `docs/features/`:
```markdown
![Dashboard](../assets/screenshots/dashboard-main-view.png)
```

---

## Tools

**Recommended tools for creating assets:**
- **Diagrams**: [draw.io](https://draw.io), [Mermaid](https://mermaid.js.org/)
- **Screenshots**: OS built-in tools, [Flameshot](https://flameshot.org/)
- **Optimization**: [TinyPNG](https://tinypng.com/), [ImageOptim](https://imageoptim.com/)
- **Editing**: [GIMP](https://www.gimp.org/), [Figma](https://figma.com/)
