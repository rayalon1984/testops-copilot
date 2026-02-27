#!/bin/bash

# Exit on error
set -e

# Print commands
set -x

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
DEPLOY_ENV=${1:-production}
DOCKER_COMPOSE_FILE="docker-compose.prod.yml"
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check required tools
check_requirements() {
    echo -e "${YELLOW}Checking deployment requirements...${NC}"
    
    local required_commands=("docker" "docker-compose" "openssl" "curl")
    local missing_commands=()
    
    for cmd in "${required_commands[@]}"; do
        if ! command_exists "$cmd"; then
            missing_commands+=("$cmd")
        fi
    done
    
    if [ ${#missing_commands[@]} -ne 0 ]; then
        echo -e "${RED}Error: Missing required commands: ${missing_commands[*]}${NC}"
        exit 1
    fi
}

# Function to validate environment variables
validate_environment() {
    echo -e "${YELLOW}Validating environment variables...${NC}"
    
    required_vars=(
        "DB_PASSWORD"
        "JWT_SECRET"
        "SLACK_WEBHOOK_URL"
        "JENKINS_TOKEN"
    )
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            echo -e "${RED}Error: Required environment variable $var is not set${NC}"
            exit 1
        fi
    done
}

# Function to backup database
backup_database() {
    echo -e "${YELLOW}Creating database backup...${NC}"
    
    mkdir -p "$BACKUP_DIR"
    docker-compose exec -T db pg_dump -U postgres testops > "$BACKUP_DIR/db_backup.sql"
}

# Function to check SSL certificates
check_ssl_certificates() {
    echo -e "${YELLOW}Checking SSL certificates...${NC}"
    
    local cert_path="./nginx/ssl/testops-copilot.crt"
    local key_path="./nginx/ssl/testops-copilot.key"
    
    if [ ! -f "$cert_path" ] || [ ! -f "$key_path" ]; then
        echo -e "${RED}Error: SSL certificates not found${NC}"
        exit 1
    fi
    
    # Check certificate expiration
    local expiry_date=$(openssl x509 -enddate -noout -in "$cert_path" | cut -d= -f2)
    local expiry_epoch=$(date -d "$expiry_date" +%s)
    local current_epoch=$(date +%s)
    local days_until_expiry=$(( ($expiry_epoch - $current_epoch) / 86400 ))
    
    if [ $days_until_expiry -lt 30 ]; then
        echo -e "${RED}Warning: SSL certificate will expire in $days_until_expiry days${NC}"
    fi
}

# Function to restore database from backup
restore_database() {
    local backup_file="$1"
    echo -e "${YELLOW}Restoring database from backup: ${backup_file}${NC}"

    docker-compose exec -T db psql -U postgres -d testops < "$backup_file"
}

# Function to run database migrations (with automatic rollback on failure)
run_migrations() {
    echo -e "${YELLOW}Running database migrations...${NC}"

    if ! docker-compose exec -T backend npm run migrate:deploy; then
        echo -e "${RED}Migration failed — restoring database from backup...${NC}"
        restore_database "${BACKUP_DIR}/db_backup.sql"
        handle_error "Database migration failed. Rolled back to pre-migration backup."
    fi
}

# Function to perform health checks
check_health() {
    echo -e "${YELLOW}Performing health checks...${NC}"
    
    local services=("frontend:80" "backend:3000" "db:5432" "redis:6379")
    local failed_checks=()
    
    for service in "${services[@]}"; do
        IFS=':' read -r -a service_parts <<< "$service"
        local service_name="${service_parts[0]}"
        local port="${service_parts[1]}"
        
        echo -e "Checking $service_name..."
        
        if ! curl -s "http://$service_name:$port/health" > /dev/null; then
            failed_checks+=("$service_name")
        fi
    done
    
    if [ ${#failed_checks[@]} -ne 0 ]; then
        echo -e "${RED}Error: Health checks failed for: ${failed_checks[*]}${NC}"
        exit 1
    fi
}

# Function to send deployment notification
notify_deployment() {
    echo -e "${YELLOW}Sending deployment notification...${NC}"
    
    local status=$1
    local message="Deployment to $DEPLOY_ENV: $status"
    
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"$message\"}" \
        "$SLACK_WEBHOOK_URL"
}

# Main deployment process
main() {
    echo -e "${GREEN}Starting deployment to $DEPLOY_ENV environment...${NC}"
    
    # Pre-deployment checks
    check_requirements
    validate_environment
    check_ssl_certificates
    
    # Backup current state
    backup_database
    
    # Deploy new version
    echo -e "${YELLOW}Deploying new version...${NC}"
    docker-compose -f $DOCKER_COMPOSE_FILE pull
    docker-compose -f $DOCKER_COMPOSE_FILE up -d
    
    # Post-deployment tasks
    run_migrations
    check_health
    
    echo -e "${GREEN}Deployment completed successfully!${NC}"
    notify_deployment "SUCCESS"
}

# Error handling
handle_error() {
    echo -e "${RED}Deployment failed: $1${NC}"
    notify_deployment "FAILED: $1"
    exit 1
}

# Run deployment
trap 'handle_error "$BASH_COMMAND"' ERR
main