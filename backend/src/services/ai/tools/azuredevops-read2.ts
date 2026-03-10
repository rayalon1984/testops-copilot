/**
 * Azure DevOps AI Tools — Read-only tools (Part 2)
 *
 * Wiki and Test Results tools split from azuredevops.ts for file-size compliance.
 * - azdo_list_wikis: List available wiki pages
 * - azdo_get_wiki_page: Get wiki page content
 * - azdo_get_test_results: Get test results from a test run
 */

import { Tool, ToolResult, ToolContext } from './types';
import { azureDevOpsService } from '@/services/azuredevops.service';
import { logger } from '@/utils/logger';

// ── Wiki Tools ───────────────────────────────────────────────────────────

export const azdoListWikisTool: Tool = {
  name: 'azdo_list_wikis',
  description:
    'List available Azure DevOps wikis and their pages. Use when the user asks about documentation, wikis, or knowledge base in Azure DevOps.',
  category: 'azuredevops',
  requiresConfirmation: false,
  parameters: [
    {
      name: 'wikiName',
      type: 'string',
      description: 'Optional wiki name to get page tree for.',
      required: false,
    },
  ],

  async execute(args: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    try {
      if (!azureDevOpsService.isEnabled()) {
        return {
          success: false,
          error: 'Azure DevOps integration is not configured.',
          summary: 'Azure DevOps is not configured.',
        };
      }

      const wikis = await azureDevOpsService.listWikis();
      const wikiName = args.wikiName as string | undefined;

      if (wikiName) {
        const wiki = wikis.find(
          w => w.name.toLowerCase().includes(wikiName.toLowerCase())
        );
        if (!wiki) {
          return {
            success: true,
            data: { wikis: wikis.map(w => ({ id: w.id, name: w.name, type: w.type })) },
            summary: `Wiki "${wikiName}" not found. Available: ${wikis.map(w => w.name).join(', ')}`,
          };
        }

        const pages = await azureDevOpsService.listWikiPages(wiki.id, '/', 'oneLevel');
        return {
          success: true,
          data: { wiki: { id: wiki.id, name: wiki.name, type: wiki.type }, pages },
          summary: `Wiki "${wiki.name}" (${wiki.type}): found page tree.`,
        };
      }

      return {
        success: true,
        data: { wikis: wikis.map(w => ({ id: w.id, name: w.name, type: w.type })) },
        summary: `Found ${wikis.length} wiki(s): ${wikis.map(w => w.name).join(', ')}`,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[azdo_list_wikis] Failed:', error);
      return { success: false, error: msg, summary: `Failed to list wikis: ${msg}` };
    }
  },
};

export const azdoGetWikiPageTool: Tool = {
  name: 'azdo_get_wiki_page',
  description:
    'Get the content of an Azure DevOps wiki page. Use when the user asks to read specific documentation or wiki pages.',
  category: 'azuredevops',
  requiresConfirmation: false,
  parameters: [
    {
      name: 'wikiId',
      type: 'string',
      description: 'Wiki ID (from azdo_list_wikis).',
      required: true,
    },
    {
      name: 'pagePath',
      type: 'string',
      description: 'Path to the wiki page (e.g., "/Getting Started" or "/Architecture/Overview").',
      required: true,
    },
  ],

  async execute(args: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    try {
      if (!azureDevOpsService.isEnabled()) {
        return {
          success: false,
          error: 'Azure DevOps integration is not configured.',
          summary: 'Azure DevOps is not configured.',
        };
      }

      const wikiId = args.wikiId as string;
      const pagePath = args.pagePath as string;

      const page = await azureDevOpsService.getWikiPage(wikiId, pagePath, true);

      return {
        success: true,
        data: {
          path: page.path,
          content: page.content,
          url: page.remoteUrl,
        },
        summary: `Wiki page "${page.path}": ${page.content ? `${page.content.length} chars of content` : 'empty page'}.`,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[azdo_get_wiki_page] Failed:', error);
      return { success: false, error: msg, summary: `Failed to get wiki page: ${msg}` };
    }
  },
};

// ── Test Results Tool ────────────────────────────────────────────────────

export const azdoGetTestResultsTool: Tool = {
  name: 'azdo_get_test_results',
  description:
    'Get test results from an Azure DevOps test run. Shows passed, failed, and skipped tests with error details. Use when the user asks about test results from Azure DevOps pipelines.',
  category: 'azuredevops',
  requiresConfirmation: false,
  parameters: [
    {
      name: 'testRunId',
      type: 'number',
      description: 'Test run ID from Azure DevOps.',
      required: true,
    },
    {
      name: 'outcomeFilter',
      type: 'string',
      description: 'Filter by outcome: "Failed", "Passed", or "all" (default: "all").',
      required: false,
      default: 'all',
    },
  ],

  async execute(args: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    try {
      if (!azureDevOpsService.isEnabled()) {
        return {
          success: false,
          error: 'Azure DevOps integration is not configured.',
          summary: 'Azure DevOps is not configured.',
        };
      }

      const testRunId = args.testRunId as number;
      const outcomeFilter = (args.outcomeFilter as string) || 'all';

      let results = await azureDevOpsService.getTestResults(testRunId);

      if (outcomeFilter !== 'all') {
        results = results.filter(r => r.outcome === outcomeFilter);
      }

      const passed = results.filter(r => r.outcome === 'Passed').length;
      const failed = results.filter(r => r.outcome === 'Failed').length;
      const other = results.length - passed - failed;

      const failedTests = results
        .filter(r => r.outcome === 'Failed')
        .slice(0, 20)
        .map(r => ({
          name: r.testCaseTitle,
          automatedTestName: r.automatedTestName,
          duration: r.durationInMs,
          errorMessage: r.errorMessage,
        }));

      return {
        success: true,
        data: {
          testRunId,
          totalResults: results.length,
          passed,
          failed,
          other,
          failedTests,
        },
        summary: `Test run #${testRunId}: ${results.length} result(s) — ${passed} passed, ${failed} failed, ${other} other. ${failedTests.length > 0 ? `Failed: ${failedTests.slice(0, 3).map(t => t.name).join(', ')}` : 'All passed!'}`,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[azdo_get_test_results] Failed:', error);
      return { success: false, error: msg, summary: `Failed to get test results: ${msg}` };
    }
  },
};
