# CI/CD Integration Guide

TestOps Companion is designed to integrate seamlessly with your existing CI/CD pipelines. This guide provides step-by-step instructions for connecting Jenkins and GitHub Actions.

## 🔗 Connection Architecture

TestOps Companion uses a **Poll & Push** hybrid approach:
1.  **Trigger**: You send a webhook or API call from your CI provider to TestOps Companion to register a test run.
2.  **Monitor**: TestOps Companion monitors the build status via the provider's API.
3.  **Analyze**: Once completed, failing tests are analyzed and results are processed.

---

## 🛠️ Jenkins Integration

### Prerequisites
*   Jenkins URL (accessible from TestOps Companion backend)
*   Jenkins User & API Token (User > Configure > API Token)
*   "Test Result" plugin (default in most installs) to generate JUnit XML reports.

### Step 1: Configure Jenkins Credentials in TestOps Companion
Currently, credentials can be configured per pipeline or globally via environment variables (roadmap). For the current version:
1.  Navigate to **Pipelines** > **New Pipeline**.
2.  Select Type: **Jenkins**.
3.  In the Configuration JSON, provide:
    ```json
    {
      "url": "https://jenkins.yourcompany.com",
      "jobName": "My-Regression-Suite",
      "credentials": {
        "username": "your_username",
        "apiToken": "your_api_token"
      },
      "notifications": {
        "enabled": true,
        "channels": ["slack"]
      }
    }
    ```

### Step 2: Configure Jenkins Pipeline (Jenkinsfile)
Add a stage to notify TestOps Companion when a build starts.

```groovy
pipeline {
    agent any
    stages {
        stage('Test') {
            steps {
                // Run your tests (e.g., via npm, maven, gradle)
                sh 'npm run test:ci'
            }
            post {
                always {
                    // 1. Publish JUnit Reports (Required for TestOps to fetch results)
                    junit '**/junit.xml'
                }
            }
        }
    }
}
```

*Note: In v2.5.5, the `JenkinsService` automatically polls standard Jenkins endpoints. Ensure your job publishes standard JUnit reports.*

---

## 🐙 GitHub Actions Integration

### Prerequisites
*   GitHub Repository
*   Personal Access Token (PAT) with `repo` scope (if using private repos)

### Step 1: Configure GitHub Pipeline in TestOps Companion
1.  Navigate to **Pipelines** > **New Pipeline**.
2.  Select Type: **GitHub Actions**.
3.  Configuration:
    ```json
    {
      "owner": "my-org",
      "repo": "my-app",
      "workflowId": "tests.yml",
      "token": "ghp_xxxxx..." 
    }
    ```

### Step 2: Add Reporting to GitHub Actions
TestOps Companion monitors workflow runs. For best results, ensure your workflow generates a summarized report or uses a standard reporter.

**Example `.github/workflows/tests.yml`**:
```yaml
name: Regression Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Playwright Tests
        run: npx playwright test --reporter=junit
        env:
          PLAYWRIGHT_JUNIT_OUTPUT_NAME: results.xml
      
      - name: Upload Test Results
        if: always()
        uses: actions/upload-artifact@v4
        with:
            name: test-results
            path: results.xml
```

---

## 🪝 Webhook Integration (Universal)

For any other CI provider (GitLab, CircleCI, etc.), use the Generic Webhook API.

**Trigger Test Run:**
`POST /api/pipelines/:id/trigger`
```json
{
  "branch": "main",
  "commit": "a1b2c3d"
}
```
