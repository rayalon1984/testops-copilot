# Grafana & Prometheus Integration

> Visualize test metrics, create custom dashboards, and set up alerts with Grafana and Prometheus.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Prometheus Setup](#prometheus-setup)
- [Grafana Setup](#grafana-setup)
- [Available Metrics](#available-metrics)
- [Pre-built Dashboards](#pre-built-dashboards)
- [Creating Custom Dashboards](#creating-custom-dashboards)
- [Alerting](#alerting)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Overview

TestOps Copilot exposes metrics in Prometheus format, allowing you to:
- Visualize test trends and patterns in Grafana
- Monitor test health in real-time
- Set up alerts for failure rate spikes
- Track RCA documentation coverage
- Analyze test execution performance

### Architecture

```
TestOps Copilot → /metrics endpoint (Prometheus format)
                          ↓
                    Prometheus (scrapes metrics)
                          ↓
                    Grafana (visualizes & alerts)
```

---

## Features

### Real-Time Test Metrics
- Total test runs, pass/fail counts
- Pass rate and failure rate percentages
- Flaky test detection
- Test execution time percentiles (P50, P95, P99)

### Knowledge Base Metrics
- Total failures archived
- RCA documentation coverage %
- Recurring failure detection
- Time to resolution tracking

### Integration Metrics
- Jira issues created
- Monday.com items created
- Notifications sent

### Custom Dashboards
- Pre-built dashboard templates
- Customizable panels and visualizations
- Multiple time ranges
- Drill-down capabilities

### Alerting
- Failure rate threshold alerts
- RCA coverage alerts
- Execution time regression alerts
- Custom alert rules

---

## Prerequisites

### Required Software

1. **TestOps Copilot**
   - Running instance with metrics endpoint enabled
   - Version 1.0.0 or higher

2. **Prometheus**
   - Version 2.30.0 or higher
   - [Download Prometheus](https://prometheus.io/download/)

3. **Grafana**
   - Version 9.0.0 or higher
   - [Download Grafana](https://grafana.com/grafana/download)

---

## Quick Start

### 1. Verify Metrics Endpoint

Check that TestOps Copilot is exposing metrics:

```bash
curl http://localhost:3000/metrics
```

Expected output:
```
# HELP testops_test_runs_total Total number of test runs
# TYPE testops_test_runs_total counter
testops_test_runs_total 1245

# HELP testops_pass_rate_percent Current pass rate percentage
# TYPE testops_pass_rate_percent gauge
testops_pass_rate_percent 94.2
...
```

### 2. Configure Prometheus

Add TestOps Copilot to your `prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'testops-companion'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
```

### 3. Start Prometheus

```bash
prometheus --config.file=prometheus.yml
```

Access Prometheus UI at `http://localhost:9090`

### 4. Configure Grafana

1. Open Grafana at `http://localhost:3000` (default)
2. Add Prometheus as a data source:
   - Go to **Configuration** → **Data Sources**
   - Click **Add data source**
   - Select **Prometheus**
   - Set URL to `http://localhost:9090`
   - Click **Save & Test**

### 5. Import Pre-built Dashboard

1. Go to **Dashboards** → **Import**
2. Upload `grafana-dashboards/testops-overview.json`
3. Select your Prometheus data source
4. Click **Import**

🎉 You're done! Your TestOps metrics are now visualized in Grafana!

---

## Prometheus Setup

### Installation

**macOS (Homebrew):**
```bash
brew install prometheus
```

**Linux:**
```bash
wget https://github.com/prometheus/prometheus/releases/download/v2.40.0/prometheus-2.40.0.linux-amd64.tar.gz
tar xvfz prometheus-2.40.0.linux-amd64.tar.gz
cd prometheus-2.40.0.linux-amd64
```

**Docker:**
```bash
docker run -d \
  -p 9090:9090 \
  -v $(pwd)/prometheus.yml:/etc/prometheus/prometheus.yml \
  prom/prometheus
```

### Configuration

Create `prometheus.yml`:

```yaml
global:
  scrape_interval: 15s       # Scrape metrics every 15 seconds
  evaluation_interval: 15s   # Evaluate rules every 15 seconds
  external_labels:
    cluster: 'testops-cluster'
    environment: 'production'

# Scrape TestOps Copilot metrics
scrape_configs:
  - job_name: 'testops-companion'
    static_configs:
      - targets: ['localhost:3000']
        labels:
          service: 'testops'
    metrics_path: '/metrics'
    scrape_interval: 30s       # Scrape TestOps every 30 seconds

  # Optional: Scrape multiple TestOps instances
  - job_name: 'testops-staging'
    static_configs:
      - targets: ['staging.testops.company.com:3000']
        labels:
          environment: 'staging'
    metrics_path: '/metrics'
```

### Verify Scraping

1. Open Prometheus UI: `http://localhost:9090`
2. Go to **Status** → **Targets**
3. Verify `testops-companion` target is **UP**
4. Query a metric: `testops_test_runs_total`

---

## Grafana Setup

### Installation

**macOS (Homebrew):**
```bash
brew install grafana
brew services start grafana
```

**Linux (Debian/Ubuntu):**
```bash
sudo apt-get install -y software-properties-common
sudo add-apt-repository "deb https://packages.grafana.com/oss/deb stable main"
wget -q -O - https://packages.grafana.com/gpg.key | sudo apt-key add -
sudo apt-get update
sudo apt-get install grafana
sudo systemctl start grafana-server
```

**Docker:**
```bash
docker run -d \
  -p 3000:3000 \
  --name=grafana \
  grafana/grafana-oss
```

### Add Prometheus Data Source

1. Login to Grafana (default: `admin` / `admin`)
2. Go to **Configuration** → **Data Sources** → **Add data source**
3. Select **Prometheus**
4. Configure:
   - **Name:** Prometheus
   - **URL:** `http://localhost:9090` (or your Prometheus URL)
   - **Access:** Server (default)
5. Click **Save & Test** (should show "Data source is working")

---

## Available Metrics

### Test Run Metrics

| Metric Name | Type | Description |
|-------------|------|-------------|
| `testops_test_runs_total` | Counter | Total number of test runs |
| `testops_test_runs_passed` | Counter | Number of passed test runs |
| `testops_test_runs_failed` | Counter | Number of failed test runs |
| `testops_test_runs_flaky` | Counter | Number of flaky test runs |

### Rate Metrics

| Metric Name | Type | Description |
|-------------|------|-------------|
| `testops_pass_rate_percent` | Gauge | Current pass rate (0-100%) |
| `testops_failure_rate_percent` | Gauge | Current failure rate (0-100%) |
| `testops_flaky_rate_percent` | Gauge | Current flaky test rate (0-100%) |

### Execution Time Metrics

| Metric Name | Type | Description |
|-------------|------|-------------|
| `testops_execution_time_avg_seconds` | Gauge | Average execution time |
| `testops_execution_time_p50_seconds` | Gauge | 50th percentile (median) |
| `testops_execution_time_p95_seconds` | Gauge | 95th percentile |
| `testops_execution_time_p99_seconds` | Gauge | 99th percentile |

### Knowledge Base Metrics

| Metric Name | Type | Description |
|-------------|------|-------------|
| `testops_failures_archived_total` | Counter | Total failures in archive |
| `testops_rcas_documented_total` | Counter | Failures with RCA documentation |
| `testops_recurring_failures_total` | Counter | Number of recurring failures |
| `testops_rca_coverage_percent` | Gauge | RCA documentation coverage (0-100%) |

### Integration Metrics

| Metric Name | Type | Description |
|-------------|------|-------------|
| `testops_jira_issues_created_total` | Counter | Jira issues created |
| `testops_monday_items_created_total` | Counter | Monday.com items created |
| `testops_notifications_sent_total` | Counter | Total notifications sent |

### Per-Test Metrics

| Metric Name | Type | Description | Labels |
|-------------|------|-------------|--------|
| `testops_test_failures_count` | Gauge | Failures per test | `test_name` |

---

## Pre-built Dashboards

### TestOps Overview Dashboard

**Location:** `grafana-dashboards/testops-overview.json`

**Panels:**
1. **Total Test Runs** - Overall test run count
2. **Pass Rate Gauge** - Current pass rate percentage
3. **Test Runs Over Time** - Passed vs Failed trend
4. **Failures Archived** - Knowledge base size
5. **RCA Coverage Gauge** - Documentation coverage
6. **Top Failing Tests** - Pie chart of most problematic tests
7. **Execution Time Percentiles** - Performance trends

**To Import:**
1. Grafana → **Dashboards** → **Import**
2. Upload `grafana-dashboards/testops-overview.json`
3. Select Prometheus data source
4. Click **Import**

---

## Creating Custom Dashboards

### Example: Failure Rate Alert Panel

1. Create new dashboard
2. Add panel
3. Query: `testops_failure_rate_percent`
4. Visualization: **Gauge**
5. Set thresholds:
   - Green: 0-5%
   - Yellow: 5-15%
   - Red: >15%
6. Save panel

### Example: Test Trend Graph

1. Add panel
2. Query:
   ```promql
   rate(testops_test_runs_passed[5m])
   ```
3. Legend: `Passed`
4. Add query:
   ```promql
   rate(testops_test_runs_failed[5m])
   ```
5. Legend: `Failed`
6. Visualization: **Time series**
7. Save panel

### Useful PromQL Queries

**Calculate failure rate:**
```promql
(testops_test_runs_failed / testops_test_runs_total) * 100
```

**Test runs per hour:**
```promql
rate(testops_test_runs_total[1h]) * 3600
```

**RCA documentation gap:**
```promql
testops_failures_archived_total - testops_rcas_documented_total
```

**Average execution time last 24h:**
```promql
avg_over_time(testops_execution_time_avg_seconds[24h])
```

---

## Alerting

### Grafana Alerts

#### Alert: High Failure Rate

1. Open dashboard panel
2. Edit → **Alert** tab
3. Create alert rule:
   - **Condition:** `testops_failure_rate_percent > 20`
   - **For:** 5 minutes
   - **Annotations:**
     - **Summary:** High test failure rate detected
     - **Description:** Failure rate is {{ $value }}%, threshold is 20%

#### Alert: Low RCA Coverage

```yaml
- alert: LowRCACoverage
  expr: testops_rca_coverage_percent < 50
  for: 1h
  labels:
    severity: warning
  annotations:
    summary: "Low RCA documentation coverage"
    description: "Only {{ $value }}% of failures have documented RCAs"
```

#### Alert: Execution Time Regression

```yaml
- alert: SlowTests
  expr: testops_execution_time_p95_seconds > 300
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "Test execution time regression"
    description: "P95 execution time is {{ $value }}s (threshold: 300s)"
```

### Notification Channels

Configure Grafana notification channels:
- **Slack:** Post to #test-alerts
- **Email:** Send to qa-team@company.com
- **PagerDuty:** For critical failures

---

## Best Practices

### Scraping Interval
- **Development:** 1 minute (60s)
- **Production:** 15-30 seconds
- **High-frequency:** 10 seconds (for critical systems)

### Data Retention
Configure Prometheus retention:
```bash
prometheus --storage.tsdb.retention.time=30d
```

### Dashboard Organization
- Create separate dashboards for different teams
- Use folders: "TestOps - QA", "TestOps - DevOps"
- Tag dashboards appropriately

### Metric Naming
- Follow Prometheus naming conventions
- Use consistent labels
- Document custom metrics

### Performance
- Limit dashboard time ranges (default: 6h)
- Use recording rules for expensive queries
- Set appropriate refresh intervals

---

## Troubleshooting

### Metrics Endpoint Not Working

**Check TestOps is running:**
```bash
curl http://localhost:3000/health
```

**Check metrics endpoint:**
```bash
curl http://localhost:3000/metrics
```

**Expected:** Prometheus-formatted text output

### Prometheus Not Scraping

**Check Prometheus targets:**
- Go to `http://localhost:9090/targets`
- Verify target is **UP**
- Check scrape errors

**Common issues:**
- Wrong URL in `prometheus.yml`
- Firewall blocking connection
- TestOps instance not running

### No Data in Grafana

**Verify data source:**
- Configuration → Data Sources → Prometheus → Test
- Should show "Data source is working"

**Check query:**
- Explore view → Run query: `testops_test_runs_total`
- Should return values

**Time range:**
- Ensure dashboard time range includes data
- Try "Last 6 hours" or "Last 24 hours"

### Slow Dashboard Loading

**Optimize queries:**
- Use recording rules for complex calculations
- Reduce time range
- Limit number of panels

**Increase resources:**
- Allocate more memory to Grafana
- Use faster storage for Prometheus

---

## Additional Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [PromQL Basics](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Grafana Dashboard Best Practices](https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/best-practices/)

---

## Support

For issues or questions:
- Check [Troubleshooting](#troubleshooting) section
- Open an issue on [GitHub](https://github.com/rayalon1984/testops-companion/issues)
- Review Prometheus/Grafana documentation

---

**Happy Monitoring! 📊**
