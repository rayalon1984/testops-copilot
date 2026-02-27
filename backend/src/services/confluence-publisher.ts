/**
 * Confluence Publishing Orchestration
 *
 * High-level workflows for publishing RCA documents and test reports to
 * Confluence. These compose the low-level CRUD methods on ConfluenceService
 * with Prisma persistence and content formatting.
 *
 * Extracted from ConfluenceService to separate API-client concerns from
 * domain-level publishing orchestration.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/utils/logger';
import { config } from '@/config';
import { buildRCAContent, buildTestReportContent } from './confluence-formatters';
import type { ConfluenceService, ConfluencePage, RCADocumentOptions, TestReportOptions } from './confluence.service';

/**
 * Publish RCA documentation from Failure Archive to Confluence.
 * Creates or updates a Confluence page and stores the mapping in DB.
 */
export async function publishRCADocument(
  service: ConfluenceService,
  failureArchiveId: string,
  options: RCADocumentOptions = {}
): Promise<string> {
  try {
    // Get failure archive entry
    const failure = await prisma.failureArchive.findUnique({
      where: { id: failureArchiveId },
    });

    if (!failure) {
      throw new Error('Failure archive entry not found');
    }

    if (!failure.rootCause) {
      throw new Error('No RCA documentation available for this failure');
    }

    // Generate page title
    const date = new Date(failure.lastOccurrence).toISOString().split('T')[0];
    const title = `RCA: ${failure.testName} - ${date}`;

    // Build Confluence content in storage format
    const content = buildRCAContent(failure, options.linkToJira !== false);

    // Check if page already exists
    const spaceKey = options.spaceKey || service.getSpaceKey();
    const parentPageId = options.parentPageId || service.getParentPageId();
    const existingPage = await service.findPageByTitle(title, spaceKey);

    let page: ConfluencePage;
    if (existingPage) {
      // Update existing page
      page = await service.updatePage(
        existingPage.id,
        title,
        content,
        existingPage.version.number
      );
    } else {
      // Create new page
      page = await service.createPage(
        title,
        content,
        spaceKey,
        parentPageId
      );
    }

    // Add labels
    const labels = [
      'rca',
      'test-failure',
      (failure.severity || 'info').toLowerCase(),
      ...(options.addLabels || []),
    ];
    await service.addLabels(page.id, labels);

    // Store the mapping
    await prisma.confluencePage.create({
      data: {
        pageId: page.id,
        title: page.title,
        spaceKey: page.space.key,
        url: `${config.confluence!.baseUrl}/wiki${page._links.webui}`,
        metadata: JSON.stringify({
          version: page.version.number,
          type: 'rca_document',
          sourceId: failureArchiveId
        })
      },
    });

    logger.info(`Published RCA document for failure ${failureArchiveId}: ${page.id}`);
    return `${config.confluence!.baseUrl}/wiki${page._links.webui}`;
  } catch (error) {
    logger.error(`Failed to publish RCA document:`, error);
    throw new Error('Failed to publish RCA document to Confluence');
  }
}

/**
 * Publish a test execution report to Confluence.
 * Creates a Confluence page with test results summary and stores the mapping in DB.
 */
export async function publishTestReport(
  service: ConfluenceService,
  testRunId: string,
  options: TestReportOptions = {}
): Promise<string> {
  try {
    // Get test run with results
    const testRun = await prisma.testRun.findUnique({
      where: { id: testRunId },
      include: {
        pipeline: true,
        results: true,
        user: true,
      },
    });

    if (!testRun) {
      throw new Error('Test run not found');
    }

    // Generate page title
    const date = new Date(testRun.createdAt).toISOString().split('T')[0];
    const title = `Test Report: ${testRun.pipeline.name} - ${date}`;

    // Build Confluence content
    const content = buildTestReportContent(testRun, options.includeFailureDetails !== false);

    // Create page
    const spaceKey = options.spaceKey || service.getSpaceKey();
    const parentPageId = options.parentPageId || service.getParentPageId();
    const page = await service.createPage(
      title,
      content,
      spaceKey,
      parentPageId
    );

    // Add labels
    const statusLabel = typeof testRun.status === 'string' ? testRun.status.toLowerCase() : String(testRun.status).toLowerCase();
    const labels = [
      'test-report',
      'automated-tests',
      statusLabel,
      ...(options.addLabels || []),
    ];
    await service.addLabels(page.id, labels);

    // Store the mapping
    await prisma.confluencePage.create({
      data: {
        pageId: page.id,
        title: page.title,
        spaceKey: page.space.key,
        url: `${config.confluence!.baseUrl}/wiki${page._links.webui}`,
        metadata: JSON.stringify({
          version: page.version.number,
          type: 'test_report',
          sourceId: testRunId
        })
      },
    });

    logger.info(`Published test report for run ${testRunId}: ${page.id}`);
    return `${config.confluence!.baseUrl}/wiki${page._links.webui}`;
  } catch (error) {
    logger.error(`Failed to publish test report:`, error);
    throw new Error('Failed to publish test report to Confluence');
  }
}
