# Contributing to TestOps Companion

First off, thank you for considering contributing to TestOps Companion! It's people like you that make TestOps Companion such a great tool.

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the issue list as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

* Use a clear and descriptive title
* Describe the exact steps which reproduce the problem
* Provide specific examples to demonstrate the steps
* Describe the behavior you observed after following the steps
* Explain which behavior you expected to see instead and why
* Include screenshots and animated GIFs if possible
* Include error messages and stack traces
* Include the version of TestOps Companion you're using

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please provide the following information:

* Use a clear and descriptive title
* Provide a step-by-step description of the suggested enhancement
* Provide specific examples to demonstrate the steps
* Describe the current behavior and explain which behavior you expected to see instead
* Explain why this enhancement would be useful
* List some other tools or applications where this enhancement exists

### Pull Requests

* Fill in the required template
* Do not include issue numbers in the PR title
* Follow the JavaScript/TypeScript styleguides
* Include screenshots and animated GIFs in your pull request whenever possible
* Document new code based on the Documentation Styleguide
* End all files with a newline

## Development Process

1. Fork the repo
2. Create a new branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run the tests (`npm test`)
5. Commit your changes (`git commit -m 'Add some amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Setting Up Development Environment

```bash
# Clone your fork
git clone https://github.com/<your-username>/testops-companion.git

# Navigate to the project directory
cd testops-companion

# Install global dependencies
npm install -g typescript ts-node

# Install dependencies and set up development environment
npm run setup

# Start the development environment
npm run dev
```

The setup script will:
- Clean existing node_modules
- Install all dependencies (root, frontend, backend)
- Set up environment files
- Start database container
- Run database migrations and seeds

### Project Structure

```
testops-companion/
├── .github/          # GitHub Actions workflows and templates
├── backend/          # Backend Node.js/Express application
├── frontend/         # Frontend React application
├── mcp-server/       # MCP server for AI-powered test analysis
├── infra/            # Infrastructure configs (nginx, prometheus, grafana)
├── specs/            # Living specifications (source of truth)
├── scripts/          # Utility scripts
├── docs/             # Documentation
└── docker-compose.yml
```

### Coding Style

* Use TypeScript for both frontend and backend
* Follow the [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)
* Use ESLint and Prettier for code formatting
* Write meaningful commit messages following [Conventional Commits](https://www.conventionalcommits.org/)

### Testing

* Write unit tests for all new code
* Ensure all tests pass before submitting a PR
* Include integration tests for new features
* Maintain or improve code coverage

```bash
# Run all tests
npm test

# Run specific tests
npm run test:frontend  # Run frontend tests only
npm run test:backend   # Run backend tests only
```

### Documentation

* Update the README.md with details of changes to the interface
* Update the API documentation if you change the API
* Add JSDoc comments for new functions and classes
* Update the TypeScript types and interfaces

## Release Process

1. Update the version number in package.json following [semver](http://semver.org/)
2. Update the CHANGELOG.md
3. Create a new release on GitHub
4. Tag the release with the version number
5. Push the release to npm if applicable

## Questions?

Feel free to open an issue with the tag `question` if you have any questions about contributing.

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.