/**
 * Feature Manifest Registry — Loads, validates, and indexes all feature manifests.
 *
 * Usage:
 *   import { loadRegistry } from './registry';
 *   const registry = loadRegistry();
 *   const giphy = registry.getFeature('giphy-integration');
 *   const assertion = registry.getAssertion('giphy.search.g-rated');
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import {
  type FeatureManifest,
  type FeatureAssertion,
  type FeatureCapability,
  type ValidationError,
  validateManifest,
} from './_schema.js';

export interface RegistryEntry {
  manifest: FeatureManifest;
  filePath: string;
}

export interface AssertionLookup {
  assertion: FeatureAssertion;
  capability: FeatureCapability;
  feature: FeatureManifest;
}

export class FeatureRegistry {
  private features: Map<string, RegistryEntry> = new Map();
  private assertions: Map<string, AssertionLookup> = new Map();

  constructor(private readonly featuresDir: string) {}

  /**
   * Loads all .feature.yaml files from the features directory.
   * Returns validation errors per file (empty map = all valid).
   */
  load(): Map<string, ValidationError[]> {
    const errorsByFile = new Map<string, ValidationError[]>();

    if (!fs.existsSync(this.featuresDir)) {
      errorsByFile.set(this.featuresDir, [{ path: '', message: 'Features directory does not exist' }]);
      return errorsByFile;
    }

    const files = fs.readdirSync(this.featuresDir)
      .filter(f => f.endsWith('.feature.yaml'));

    for (const file of files) {
      const filePath = path.join(this.featuresDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');

      let parsed: unknown;
      try {
        parsed = yaml.load(content);
      } catch (e) {
        errorsByFile.set(file, [{ path: '', message: `YAML parse error: ${(e as Error).message}` }]);
        continue;
      }

      const validationErrors = validateManifest(parsed);
      if (validationErrors.length > 0) {
        errorsByFile.set(file, validationErrors);
        continue;
      }

      const manifest = parsed as FeatureManifest;

      // Check for duplicate feature IDs
      if (this.features.has(manifest.feature)) {
        errorsByFile.set(file, [{
          path: 'feature',
          message: `Duplicate feature ID "${manifest.feature}" (already defined in ${this.features.get(manifest.feature)!.filePath})`,
        }]);
        continue;
      }

      // Index the feature
      this.features.set(manifest.feature, { manifest, filePath });

      // Index all assertions
      for (const cap of manifest.capabilities) {
        for (const assertion of cap.assertions) {
          if (this.assertions.has(assertion.id)) {
            const existing = this.assertions.get(assertion.id)!;
            const existingFile = this.features.get(existing.feature.feature)?.filePath ?? 'unknown';
            errorsByFile.set(file, [{
              path: `assertion.${assertion.id}`,
              message: `Duplicate assertion ID "${assertion.id}" (already defined in ${existingFile})`,
            }]);
          } else {
            this.assertions.set(assertion.id, { assertion, capability: cap, feature: manifest });
          }
        }
      }
    }

    return errorsByFile;
  }

  /** Get a feature manifest by ID */
  getFeature(featureId: string): FeatureManifest | undefined {
    return this.features.get(featureId)?.manifest;
  }

  /** Get an assertion and its context by ID */
  getAssertion(assertionId: string): AssertionLookup | undefined {
    return this.assertions.get(assertionId);
  }

  /** Get all loaded features */
  getAllFeatures(): FeatureManifest[] {
    return [...this.features.values()].map(e => e.manifest);
  }

  /** Get all assertion IDs */
  getAllAssertionIds(): string[] {
    return [...this.assertions.keys()];
  }

  /** Get assertions filtered by type */
  getAssertionsByType(type: 'invariant' | 'behavioral' | 'contract'): AssertionLookup[] {
    return [...this.assertions.values()].filter(a => a.assertion.type === type);
  }

  /** Get all assertions for a feature */
  getAssertionsForFeature(featureId: string): AssertionLookup[] {
    return [...this.assertions.values()].filter(a => a.feature.feature === featureId);
  }

  /** Total count of features loaded */
  get featureCount(): number {
    return this.features.size;
  }

  /** Total count of assertions indexed */
  get assertionCount(): number {
    return this.assertions.size;
  }
}

/**
 * Factory function — loads and returns a populated registry.
 * Throws if any manifest has schema validation errors.
 */
export function loadRegistry(featuresDir?: string): FeatureRegistry {
  const dir = featuresDir ?? path.resolve(__dirname, '.');
  const registry = new FeatureRegistry(dir);
  const errors = registry.load();

  if (errors.size > 0) {
    const messages = [...errors.entries()]
      .map(([file, errs]) => `  ${file}:\n${errs.map(e => `    - [${e.path}] ${e.message}`).join('\n')}`)
      .join('\n');
    throw new Error(`Feature manifest validation errors:\n${messages}`);
  }

  return registry;
}
