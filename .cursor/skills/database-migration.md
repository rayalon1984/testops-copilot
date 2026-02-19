# Reusable Workflow for Database Migrations

This workflow is designed to facilitate database migrations, allowing for easy management and execution of migration scripts across different environments.

## Workflow Steps

1. **Setup Environment**  
   Define the environment variables required for the migration, such as database connection strings.

2. **Run Migrations**  
   Execute the migration scripts sequentially or concurrently, based on the database management system used.

3. **Verification**  
   Validate the migration results by checking the expected state of the database after each migration.

4. **Cleanup**  
   Revert any changes if the migration fails, ensuring database integrity.

## Example Usage

```yaml
name: Database Migration

on:
  workflow_dispatch:

jobs:
  migrate:
    runs-on: ubuntu-latest

    steps:
    - name: Checkout repository
      uses: actions/checkout@v2

    - name: Set up database
      run: |
        echo "Setting up database..."

    - name: Run migrations
      run: |
        for script in ./migrations/*.sql; do
          psql -U $DB_USER -d $DB_NAME -f "$script";
        done

    - name: Verify migrations
      run: |
        echo "Verifying migrations..."

    - name: Cleanup
      run: |
        echo "Cleaning up..."
```

## Additional Notes
- Be cautious when running migrations on production databases. It is advisable to test migrations in a staging environment first.
- Ensure that all migration scripts are idempotent to avoid issues during execution.