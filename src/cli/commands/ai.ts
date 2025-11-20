/**
 * AI CLI Commands
 *
 * Command-line interface for AI features including RCA matching,
 * cost tracking, and health checks.
 */

import { Command } from 'commander';
import { Pool } from 'pg';
import { initializeAI, getAIManager, shutdownAI, TestFailure } from '../../services/ai';

/**
 * Create AI command group
 */
export function createAICommands(db: Pool): Command {
  const ai = new Command('ai');
  ai.description('AI-powered features for test analysis');

  /**
   * ai health - Check AI services health
   */
  ai.command('health')
    .description('Check health of AI services')
    .action(async () => {
      try {
        const manager = await initializeAI({ db });
        const health = await manager.healthCheck();

        console.log('\n🔍 AI Services Health Check\n');
        console.log(`Overall Status: ${health.healthy ? '✅ Healthy' : '❌ Unhealthy'}\n`);

        if (health.services.provider) {
          console.log(`Provider (${health.services.provider.name}):`);
          console.log(`  Status: ${health.services.provider.healthy ? '✅' : '❌'}`);
          if (health.services.provider.error) {
            console.log(`  Error: ${health.services.provider.error}`);
          }
        }

        if (health.services.vectorDB) {
          console.log(`\nVector Database:`);
          console.log(`  Status: ${health.services.vectorDB.healthy ? '✅' : '❌'}`);
          if (health.services.vectorDB.error) {
            console.log(`  Error: ${health.services.vectorDB.error}`);
          }
        }

        if (health.services.cache) {
          console.log(`\nCache:`);
          console.log(`  Status: ${health.services.cache.healthy ? '✅' : '❌'}`);
          if (health.services.cache.stats) {
            console.log(`  Hit Rate: ${(health.services.cache.stats.hitRate * 100).toFixed(1)}%`);
            console.log(`  Hits: ${health.services.cache.stats.hits}`);
            console.log(`  Misses: ${health.services.cache.stats.misses}`);
          }
        }

        await shutdownAI();
        process.exit(health.healthy ? 0 : 1);
      } catch (error) {
        console.error('❌ Health check failed:', error);
        process.exit(1);
      }
    });

  /**
   * ai costs - Show cost summary
   */
  ai.command('costs')
    .description('Show AI usage and cost summary')
    .option('-s, --start <date>', 'Start date (YYYY-MM-DD)')
    .option('-e, --end <date>', 'End date (YYYY-MM-DD)')
    .action(async (options) => {
      try {
        const manager = await initializeAI({ db });

        let summary;
        if (options.start && options.end) {
          summary = await manager.getCostSummary(
            new Date(options.start),
            new Date(options.end)
          );
        } else {
          summary = await manager.getCostSummary();
        }

        console.log('\n💰 AI Cost Summary\n');
        console.log(`Period: ${summary.period.start.toLocaleDateString()} - ${summary.period.end.toLocaleDateString()}`);
        console.log(`Total Cost: $${summary.totalCost.toFixed(4)}`);
        console.log(`Total Requests: ${summary.totalRequests}`);
        console.log(`Total Tokens: ${summary.totalTokens.toLocaleString()}`);
        console.log(`Cache Hit Rate: ${(summary.cacheHitRate * 100).toFixed(1)}%`);
        console.log(`Budget Used: ${summary.budgetUsed.toFixed(1)}%\n`);

        if (summary.byFeature.length > 0) {
          console.log('By Feature:');
          for (const feature of summary.byFeature) {
            console.log(`  ${feature.feature}: $${feature.cost.toFixed(4)} (${feature.requests} requests)`);
          }
          console.log();
        }

        if (summary.byProvider.length > 0) {
          console.log('By Provider:');
          for (const provider of summary.byProvider) {
            console.log(`  ${provider.provider}: $${provider.cost.toFixed(4)} (${provider.requests} requests)`);
          }
          console.log();
        }

        await shutdownAI();
      } catch (error) {
        console.error('❌ Failed to get cost summary:', error);
        process.exit(1);
      }
    });

  /**
   * ai stats - Show overall statistics
   */
  ai.command('stats')
    .description('Show overall AI statistics')
    .action(async () => {
      try {
        const manager = await initializeAI({ db });

        const [costSummary, cacheStats, rcaStats] = await Promise.all([
          manager.getCostSummary(),
          manager.getCacheStats(),
          manager.getRCAStats(),
        ]);

        console.log('\n📊 AI Statistics\n');

        console.log('💰 Costs:');
        console.log(`  Total: $${costSummary.totalCost.toFixed(4)}`);
        console.log(`  Requests: ${costSummary.totalRequests}`);
        console.log(`  Budget Used: ${costSummary.budgetUsed.toFixed(1)}%\n`);

        console.log('⚡ Cache:');
        console.log(`  Hit Rate: ${(cacheStats.hitRate * 100).toFixed(1)}%`);
        console.log(`  Hits: ${cacheStats.hits}`);
        console.log(`  Misses: ${cacheStats.misses}\n`);

        console.log('🔍 RCA Matching:');
        console.log(`  Total Failures: ${rcaStats.total}`);
        console.log(`  Resolved: ${rcaStats.resolved}`);
        console.log(`  Unresolved: ${rcaStats.unresolved}\n`);

        await shutdownAI();
      } catch (error) {
        console.error('❌ Failed to get statistics:', error);
        process.exit(1);
      }
    });

  /**
   * ai rca find - Find similar failures
   */
  ai.command('rca')
    .description('RCA (Root Cause Analysis) matching')
    .argument('<test-id>', 'Test ID to find similar failures for')
    .option('-e, --error <message>', 'Error message')
    .option('-s, --stack <trace>', 'Stack trace')
    .option('-l, --limit <n>', 'Maximum number of results', '5')
    .option('-m, --min-similarity <n>', 'Minimum similarity threshold (0-1)', '0.75')
    .option('-p, --pipeline <name>', 'Filter by pipeline')
    .option('-b, --branch <name>', 'Filter by branch')
    .action(async (testId, options) => {
      try {
        const manager = await initializeAI({ db });

        if (!manager.isFeatureEnabled('rcaMatching')) {
          console.error('❌ RCA matching is not enabled');
          process.exit(1);
        }

        if (!options.error) {
          console.error('❌ Error message is required (use -e or --error)');
          process.exit(1);
        }

        const failure: TestFailure = {
          id: '',
          testId,
          testName: testId,
          errorMessage: options.error,
          stackTrace: options.stack,
          pipeline: options.pipeline || 'unknown',
          branch: options.branch || 'main',
          commitHash: 'unknown',
          timestamp: new Date(),
        };

        console.log('\n🔍 Finding similar failures...\n');

        const similar = await manager.findSimilarFailures(failure, {
          limit: parseInt(options.limit, 10),
          minSimilarity: parseFloat(options.minSimilarity),
          pipeline: options.pipeline,
          branch: options.branch,
        });

        if (similar.length === 0) {
          console.log('No similar failures found.');
        } else {
          console.log(`Found ${similar.length} similar failure(s):\n`);

          for (let i = 0; i < similar.length; i++) {
            const sf = similar[i];
            console.log(`${i + 1}. ${sf.failure.testName}`);
            console.log(`   Similarity: ${(sf.similarity * 100).toFixed(1)}%`);
            console.log(`   Error: ${sf.failure.errorMessage.substring(0, 80)}...`);
            console.log(`   Explanation: ${sf.explanation}`);
            if (sf.resolution) {
              console.log(`   Resolution: ${sf.resolution}`);
              console.log(`   Resolved: ${sf.resolvedAt?.toLocaleDateString()} by ${sf.resolvedBy}`);
              if (sf.ticketUrl) {
                console.log(`   Ticket: ${sf.ticketUrl}`);
              }
            }
            console.log();
          }
        }

        await shutdownAI();
      } catch (error) {
        console.error('❌ RCA matching failed:', error);
        process.exit(1);
      }
    });

  /**
   * ai categorize - Categorize a test failure
   */
  ai.command('categorize')
    .description('Categorize a test failure')
    .argument('<test-id>', 'Test ID to categorize')
    .option('-e, --error <message>', 'Error message')
    .option('-s, --stack <trace>', 'Stack trace')
    .option('-l, --log <snippet>', 'Log snippet')
    .action(async (testId, options) => {
      try {
        const manager = await initializeAI({ db });

        if (!manager.isFeatureEnabled('categorization')) {
          console.error('❌ Categorization is not enabled');
          process.exit(1);
        }

        if (!options.error) {
          console.error('❌ Error message is required (use -e or --error)');
          process.exit(1);
        }

        const failure: TestFailure = {
          id: '',
          testId,
          testName: testId,
          errorMessage: options.error,
          stackTrace: options.stack,
          logSnippet: options.log,
          pipeline: 'cli',
          branch: 'main',
          commitHash: 'unknown',
          timestamp: new Date(),
        };

        console.log('\n🔍 Categorizing test failure...\n');

        const categorization = await manager.categorizeFailure(failure);

        console.log(`Category: ${categorization.category}`);
        console.log(`Confidence: ${(categorization.confidence * 100).toFixed(1)}%`);
        console.log(`\nReasoning: ${categorization.reasoning}`);
        console.log(`\nSuggested Action: ${categorization.suggestedAction}`);

        if (categorization.relatedIssues && categorization.relatedIssues.length > 0) {
          console.log(`\nRelated Issues:`);
          categorization.relatedIssues.forEach(issue => console.log(`  - ${issue}`));
        }

        console.log();

        await shutdownAI();
      } catch (error) {
        console.error('❌ Categorization failed:', error);
        process.exit(1);
      }
    });

  /**
   * ai summarize - Summarize test failure logs
   */
  ai.command('summarize')
    .description('Summarize test failure logs')
    .argument('<test-name>', 'Test name')
    .option('-e, --error <message>', 'Error message')
    .option('-l, --log-file <path>', 'Path to log file')
    .option('-t, --log-text <text>', 'Log text directly')
    .action(async (testName, options) => {
      try {
        const manager = await initializeAI({ db });

        if (!manager.isFeatureEnabled('logSummary')) {
          console.error('❌ Log summarization is not enabled');
          process.exit(1);
        }

        if (!options.error) {
          console.error('❌ Error message is required (use -e or --error)');
          process.exit(1);
        }

        let logs = '';
        if (options.logFile) {
          const fs = require('fs');
          logs = fs.readFileSync(options.logFile, 'utf8');
        } else if (options.logText) {
          logs = options.logText;
        } else {
          console.error('❌ Either --log-file or --log-text is required');
          process.exit(1);
        }

        console.log('\n📝 Summarizing logs...\n');

        const summary = await manager.summarizeLogs(logs, testName, options.error);

        console.log(`Summary: ${summary.summary}`);
        console.log(`\nRoot Cause: ${summary.rootCause}`);
        console.log(`\nSuggested Fix: ${summary.suggestedFix}`);
        console.log(`\nConfidence: ${(summary.confidence * 100).toFixed(1)}%`);

        if (summary.errorLocation) {
          console.log(`\nError Location:`);
          console.log(`  File: ${summary.errorLocation.file}`);
          console.log(`  Line: ${summary.errorLocation.line}`);
          if (summary.errorLocation.snippet) {
            console.log(`  Snippet: ${summary.errorLocation.snippet}`);
          }
        }

        if (summary.keyLogLines && summary.keyLogLines.length > 0) {
          console.log(`\nKey Log Lines:`);
          summary.keyLogLines.slice(0, 5).forEach(line => {
            console.log(`  [${line.relevance}] ${line.content.substring(0, 100)}...`);
          });
        }

        console.log();

        await shutdownAI();
      } catch (error) {
        console.error('❌ Log summarization failed:', error);
        process.exit(1);
      }
    });

  return ai;
}
