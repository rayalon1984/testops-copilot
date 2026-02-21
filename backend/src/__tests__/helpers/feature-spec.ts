/**
 * Feature Spec Test Helpers — Wire tests to feature manifests.
 *
 * Usage:
 *   import { describeFeature, itAssertion } from '../helpers/feature-spec';
 *
 *   describeFeature('giphy-integration', () => {
 *     itAssertion('giphy.search.g-rated', () => {
 *       expect(result.rating).toBe('g');
 *     });
 *   });
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import type {
  FeatureManifest,
  FeatureAssertion,
  FeatureCapability,
} from '../../../../specs/features/_schema';

// --- Version tracker ---

interface CapabilityVersionRecord {
  [capabilityId: string]: string;
}

interface FeatureVersionRecord {
  lastTestedVersion: string;
  capabilities: CapabilityVersionRecord;
  lastRun: string;
}

interface VersionTracker {
  [featureId: string]: FeatureVersionRecord;
}

const FEATURES_DIR = path.resolve(__dirname, '../../../../specs/features');
const TRACKER_PATH = path.resolve(__dirname, 'spec-version-tracker.json');

function loadTracker(): VersionTracker {
  try {
    const raw = fs.readFileSync(TRACKER_PATH, 'utf-8');
    return JSON.parse(raw) as VersionTracker;
  } catch {
    return {};
  }
}

function saveTracker(tracker: VersionTracker): void {
  fs.writeFileSync(TRACKER_PATH, JSON.stringify(tracker, null, 2) + '\n', 'utf-8');
}

function loadManifest(featureId: string): FeatureManifest {
  const filePath = path.join(FEATURES_DIR, `${featureId}.feature.yaml`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Feature manifest not found: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  const manifest = yaml.load(content) as FeatureManifest;
  if (manifest.feature !== featureId) {
    throw new Error(`Feature ID mismatch: expected "${featureId}", got "${manifest.feature}"`);
  }
  return manifest;
}

function findAssertion(
  manifest: FeatureManifest,
  assertionId: string,
): { assertion: FeatureAssertion; capability: FeatureCapability } | null {
  for (const cap of manifest.capabilities) {
    for (const assertion of cap.assertions) {
      if (assertion.id === assertionId) {
        return { assertion, capability: cap };
      }
    }
  }
  return null;
}

// --- Public API ---

/** Active feature context — set by describeFeature, read by itAssertion */
let _activeManifest: FeatureManifest | null = null;
let _activeTracker: VersionTracker | null = null;

/**
 * Creates a describe block tied to a feature manifest.
 * Loads the manifest and updates the version tracker after all tests run.
 */
export function describeFeature(
  featureId: string,
  fn: (feature: FeatureManifest) => void,
): void {
  describe(`[Feature: ${featureId}]`, () => {
    const manifest = loadManifest(featureId);
    const tracker = loadTracker();

    beforeAll(() => {
      _activeManifest = manifest;
      _activeTracker = tracker;
    });

    afterAll(() => {
      // Update tracker with current versions
      const capVersions: CapabilityVersionRecord = {};
      for (const cap of manifest.capabilities) {
        capVersions[cap.id] = cap.version;
      }
      tracker[featureId] = {
        lastTestedVersion: manifest.version,
        capabilities: capVersions,
        lastRun: new Date().toISOString(),
      };
      saveTracker(tracker);
      _activeManifest = null;
      _activeTracker = null;
    });

    fn(manifest);
  });
}

/**
 * Creates a test case tied to a specific assertion ID.
 *
 * Behavior:
 * - If the assertion doesn't exist in the manifest → test error
 * - If the assertion is deprecated → test.skip
 * - If the assertion is behavioral and its capability version changed → test.todo
 * - Otherwise → normal test execution
 */
export function itAssertion(
  assertionId: string,
  fn: () => void,
): void {
  if (!_activeManifest) {
    throw new Error('itAssertion() must be called inside describeFeature()');
  }

  const manifest = _activeManifest;
  const tracker = _activeTracker ?? {};
  const found = findAssertion(manifest, assertionId);

  if (!found) {
    it(`[ORPHAN] ${assertionId}`, () => {
      throw new Error(
        `Assertion "${assertionId}" not found in feature manifest "${manifest.feature}". ` +
        'Remove this test or add the assertion to the manifest.',
      );
    });
    return;
  }

  const { assertion, capability } = found;

  // Skip deprecated assertions
  if (assertion.deprecated) {
    it.skip(`[DEPRECATED] ${assertionId}: ${assertion.description}`, () => {});
    return;
  }

  // Check for version drift on behavioral assertions
  if (assertion.type === 'behavioral') {
    const featureRecord = tracker[manifest.feature];
    if (featureRecord) {
      const lastCapVersion = featureRecord.capabilities[capability.id];
      if (lastCapVersion && lastCapVersion !== capability.version) {
        it.todo(
          `[SPEC DRIFT] ${assertionId}: capability "${capability.id}" version changed ` +
          `(${lastCapVersion} → ${capability.version}). Update test to match new behavior.`,
        );
        return;
      }
    }
  }

  // Normal test execution with assertion metadata in name
  const typeTag = assertion.type.toUpperCase();
  it(`[${typeTag}] ${assertionId}: ${assertion.description}`, fn);
}

/**
 * Returns all assertion IDs for a loaded feature manifest.
 * Useful for coverage reporting.
 */
export function getAssertionIds(manifest: FeatureManifest): string[] {
  const ids: string[] = [];
  for (const cap of manifest.capabilities) {
    for (const assertion of cap.assertions) {
      ids.push(assertion.id);
    }
  }
  return ids;
}
