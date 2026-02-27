# Variables
DOCKER_COMPOSE = docker-compose
FRONTEND_DIR = frontend
BACKEND_DIR = backend
NODE = node
NPM = npm

# Colors
GREEN = \033[0;32m
YELLOW = \033[1;33m
NC = \033[0m

.PHONY: help setup dev down clean test lint build deploy

help: ## Display this help message
	@echo "TestOps Copilot Development Commands"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "$(YELLOW)%-30s$(NC) %s\n", $$1, $$2}'

setup: ## Initial setup of development environment
	@echo "$(GREEN)Setting up development environment...$(NC)"
	@chmod +x scripts/setup-dev.sh
	@./scripts/setup-dev.sh

dev: ## Start development environment
	@echo "$(GREEN)Starting development environment...$(NC)"
	$(DOCKER_COMPOSE) up -d

down: ## Stop development environment
	@echo "$(GREEN)Stopping development environment...$(NC)"
	$(DOCKER_COMPOSE) down

clean: down ## Clean development environment (remove containers, volumes, node_modules)
	@echo "$(GREEN)Cleaning development environment...$(NC)"
	$(DOCKER_COMPOSE) down -v
	rm -rf $(FRONTEND_DIR)/node_modules
	rm -rf $(BACKEND_DIR)/node_modules
	rm -rf $(FRONTEND_DIR)/dist
	rm -rf $(BACKEND_DIR)/dist

test: ## Run all tests
	@echo "$(GREEN)Running frontend tests...$(NC)"
	cd $(FRONTEND_DIR) && $(NPM) test
	@echo "$(GREEN)Running backend tests...$(NC)"
	cd $(BACKEND_DIR) && $(NPM) test

lint: ## Run linting
	@echo "$(GREEN)Linting frontend...$(NC)"
	cd $(FRONTEND_DIR) && $(NPM) run lint
	@echo "$(GREEN)Linting backend...$(NC)"
	cd $(BACKEND_DIR) && $(NPM) run lint

build: ## Build for production
	@echo "$(GREEN)Building frontend...$(NC)"
	cd $(FRONTEND_DIR) && $(NPM) run build
	@echo "$(GREEN)Building backend...$(NC)"
	cd $(BACKEND_DIR) && $(NPM) run build

deploy: build ## Deploy to production
	@echo "$(GREEN)Deploying application...$(NC)"
	$(DOCKER_COMPOSE) -f docker-compose.prod.yml up -d

db-migrate: ## Run database migrations
	@echo "$(GREEN)Running database migrations...$(NC)"
	cd $(BACKEND_DIR) && $(NPM) run migrate:deploy

db-seed: ## Seed database with test data
	@echo "$(GREEN)Seeding database...$(NC)"
	cd $(BACKEND_DIR) && $(NPM) run seed

generate-types: ## Generate TypeScript types
	@echo "$(GREEN)Generating TypeScript types...$(NC)"
	cd $(BACKEND_DIR) && $(NPM) run generate:types

logs: ## View logs
	$(DOCKER_COMPOSE) logs -f

ps: ## List containers
	$(DOCKER_COMPOSE) ps

restart: down dev ## Restart development environment
	@echo "$(GREEN)Development environment restarted$(NC)"