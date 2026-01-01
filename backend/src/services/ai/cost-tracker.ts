/**
 * AI Services - Cost Tracking
 *
 * Tracks AI usage and costs to stay within budget limits.
 * Provides alerts when approaching budget thresholds.
 */

import { Pool } from 'pg';
import { AIFeature, AIProviderName, CostSummary, UsageEntry } from './types';

export interface CostConfig {
  monthlyBudgetUSD: number;
  alertThresholdPercent: number;
  alertEmail?: string;
}

export interface UsageRecord {
  timestamp: Date;
  provider: AIProviderName;
  model: string;
  feature: AIFeature;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUSD: number;
  cached: boolean;
}

/**
 * Cost Tracker
 */
export class CostTracker {
  private db: Pool;
  private config: CostConfig;
  private alertSent: boolean = false;

  constructor(db: Pool, config: CostConfig) {
    this.db = db;
    this.config = config;
  }

  /**
   * Initialize database schema
   */
  async initialize(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS ai_usage (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
        provider VARCHAR(50) NOT NULL,
        model VARCHAR(100) NOT NULL,
        feature VARCHAR(50) NOT NULL,
        input_tokens INTEGER NOT NULL,
        output_tokens INTEGER NOT NULL,
        total_tokens INTEGER NOT NULL,
        cost_usd DECIMAL(10, 6) NOT NULL,
        cached BOOLEAN NOT NULL DEFAULT FALSE,
        user_id VARCHAR(255),
        request_id VARCHAR(255),
        response_time_ms INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_ai_usage_timestamp ON ai_usage(timestamp);
      CREATE INDEX IF NOT EXISTS idx_ai_usage_provider ON ai_usage(provider);
      CREATE INDEX IF NOT EXISTS idx_ai_usage_feature ON ai_usage(feature);
      CREATE INDEX IF NOT EXISTS idx_ai_usage_user ON ai_usage(user_id);
    `;

    await this.db.query(query);
  }

  /**
   * Record a usage event
   */
  async recordUsage(record: UsageRecord): Promise<void> {
    const query = `
      INSERT INTO ai_usage (
        timestamp, provider, model, feature,
        input_tokens, output_tokens, total_tokens,
        cost_usd, cached
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;

    const values = [
      record.timestamp,
      record.provider,
      record.model,
      record.feature,
      record.inputTokens,
      record.outputTokens,
      record.totalTokens,
      record.costUSD,
      record.cached,
    ];

    await this.db.query(query, values);

    // Check if we're approaching budget limit
    await this.checkBudgetAlert();
  }

  /**
   * Get usage summary for a time period
   */
  async getSummary(startDate: Date, endDate: Date): Promise<CostSummary> {
    // Get total cost and requests
    const totalQuery = `
      SELECT
        COUNT(*) as total_requests,
        SUM(total_tokens) as total_tokens,
        SUM(cost_usd) as total_cost,
        SUM(CASE WHEN cached THEN 1 ELSE 0 END) as cache_hits
      FROM ai_usage
      WHERE timestamp >= $1 AND timestamp < $2
    `;

    const totalResult = await this.db.query(totalQuery, [startDate, endDate]);
    const total = totalResult.rows[0];

    // Get breakdown by feature
    const featureQuery = `
      SELECT
        feature,
        COUNT(*) as requests,
        SUM(total_tokens) as tokens,
        SUM(cost_usd) as cost
      FROM ai_usage
      WHERE timestamp >= $1 AND timestamp < $2
      GROUP BY feature
    `;

    const featureResult = await this.db.query(featureQuery, [startDate, endDate]);

    // Get breakdown by provider
    const providerQuery = `
      SELECT
        provider,
        COUNT(*) as requests,
        SUM(cost_usd) as cost
      FROM ai_usage
      WHERE timestamp >= $1 AND timestamp < $2
      GROUP BY provider
    `;

    const providerResult = await this.db.query(providerQuery, [startDate, endDate]);

    // Calculate cache hit rate
    const totalRequests = parseInt(total.total_requests, 10) || 0;
    const cacheHits = parseInt(total.cache_hits, 10) || 0;
    const cacheHitRate = totalRequests > 0 ? cacheHits / totalRequests : 0;

    // Calculate budget usage percentage
    const totalCost = parseFloat(total.total_cost) || 0;
    const budgetUsed = (totalCost / this.config.monthlyBudgetUSD) * 100;

    return {
      period: { start: startDate, end: endDate },
      totalCost,
      totalRequests,
      totalTokens: parseInt(total.total_tokens, 10) || 0,
      byFeature: featureResult.rows.map((row) => ({
        feature: row.feature as AIFeature,
        cost: parseFloat(row.cost),
        requests: parseInt(row.requests, 10),
        tokens: parseInt(row.tokens, 10),
      })),
      byProvider: providerResult.rows.map((row) => ({
        provider: row.provider as AIProviderName,
        cost: parseFloat(row.cost),
        requests: parseInt(row.requests, 10),
      })),
      cacheHitRate,
      budgetUsed,
    };
  }

  /**
   * Get current month summary
   */
  async getCurrentMonthSummary(): Promise<CostSummary> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    return await this.getSummary(startOfMonth, endOfMonth);
  }

  /**
   * Get usage entries for a time period
   */
  async getUsageEntries(
    startDate: Date,
    endDate: Date,
    limit: number = 100
  ): Promise<UsageEntry[]> {
    const query = `
      SELECT
        timestamp,
        provider,
        model,
        feature,
        input_tokens,
        output_tokens,
        total_tokens,
        cost_usd,
        cached
      FROM ai_usage
      WHERE timestamp >= $1 AND timestamp < $2
      ORDER BY timestamp DESC
      LIMIT $3
    `;

    const result = await this.db.query(query, [startDate, endDate, limit]);

    return result.rows.map((row) => ({
      timestamp: row.timestamp,
      provider: row.provider,
      model: row.model,
      feature: row.feature,
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      totalTokens: row.total_tokens,
      costUSD: parseFloat(row.cost_usd),
      cached: row.cached,
      userId: row.user_id || 'system',
      teamId: row.team_id || 'system',
      responseTimeMs: row.response_time_ms || 0,
      cacheHit: row.cache_hit || false,
    }));
  }

  /**
   * Check if we're approaching budget limit and send alert
   */
  private async checkBudgetAlert(): Promise<void> {
    if (this.alertSent) {
      return; // Alert already sent this month
    }

    const summary = await this.getCurrentMonthSummary();

    if (summary.budgetUsed >= this.config.alertThresholdPercent) {
      await this.sendBudgetAlert(summary);
      this.alertSent = true;
    }
  }

  /**
   * Send budget alert
   */
  private async sendBudgetAlert(summary: CostSummary): Promise<void> {
    const message = `
      ⚠️ AI Budget Alert

      Current usage: $${summary.totalCost.toFixed(2)} (${summary.budgetUsed.toFixed(1)}% of monthly budget)
      Monthly budget: $${this.config.monthlyBudgetUSD}
      Alert threshold: ${this.config.alertThresholdPercent}%

      Total requests: ${summary.totalRequests}
      Cache hit rate: ${(summary.cacheHitRate * 100).toFixed(1)}%

      Breakdown by feature:
      ${summary.byFeature.map(f => `  - ${f.feature}: $${f.cost.toFixed(2)} (${f.requests} requests)`).join('\n')}
    `;

    console.warn(message);

    // TODO: Send email if configured
    if (this.config.alertEmail) {
      // Implementation would go here
      console.log(`Budget alert would be sent to: ${this.config.alertEmail}`);
    }
  }

  /**
   * Reset alert flag (call at start of new month)
   */
  resetAlertFlag(): void {
    this.alertSent = false;
  }

  /**
   * Get top cost drivers
   */
  async getTopCostDrivers(
    startDate: Date,
    endDate: Date,
    limit: number = 10
  ): Promise<Array<{ feature: AIFeature; cost: number; requests: number }>> {
    const query = `
      SELECT
        feature,
        SUM(cost_usd) as cost,
        COUNT(*) as requests
      FROM ai_usage
      WHERE timestamp >= $1 AND timestamp < $2
      GROUP BY feature
      ORDER BY cost DESC
      LIMIT $3
    `;

    const result = await this.db.query(query, [startDate, endDate, limit]);

    return result.rows.map((row) => ({
      feature: row.feature as AIFeature,
      cost: parseFloat(row.cost),
      requests: parseInt(row.requests, 10),
    }));
  }

  /**
   * Project end-of-month cost
   */
  async projectMonthEndCost(): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayOfMonth = now.getDate();

    const summary = await this.getSummary(startOfMonth, now);

    // Simple linear projection
    if (dayOfMonth === 0) return 0;
    return (summary.totalCost / dayOfMonth) * daysInMonth;
  }
}

// Export singleton getter
let costTracker: CostTracker | null = null;

export function getCostTracker(db: Pool, config: CostConfig): CostTracker {
  if (!costTracker) {
    costTracker = new CostTracker(db, config);
  }
  return costTracker;
}
