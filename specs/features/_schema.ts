/**
 * Feature Manifest Schema — TypeScript types for YAML validation
 *
 * These types define the structure of `.feature.yaml` manifest files.
 * Used by the registry (loader/validator) and CI scanner.
 */

export type AssertionType = 'invariant' | 'behavioral' | 'contract';
export type FeatureStatus = 'draft' | 'shipped' | 'deprecated';

export interface EnvConfig {
  required: boolean;
  default?: string;
  description: string;
}

export interface FeatureAssertion {
  /** Globally unique dot-notation ID (e.g., "giphy.search.g-rated") */
  id: string;
  description: string;
  type: AssertionType;
  /** If true, skip in tests */
  deprecated?: boolean;
  /** Product version when this assertion was added */
  since_version?: string;
}

export interface FeatureCapability {
  id: string;
  name: string;
  /** SemVer — independent of feature version */
  version: string;
  description: string;
  /** AI tool name if applicable */
  tool?: string;
  /** Source files implementing this capability */
  files: string[];
  assertions: FeatureAssertion[];
}

export interface AcceptanceCriterion {
  /** e.g., "AC-3" */
  id: string;
  title: string;
  gherkin: string;
  /** Assertion IDs this AC covers */
  maps_to: string[];
}

export interface ChangelogEntry {
  version: string;
  date: string;
  product_version: string;
  changes: string[];
}

export interface FeatureManifest {
  /** kebab-case unique ID */
  feature: string;
  name: string;
  /** SemVer — overall feature version */
  version: string;
  status: FeatureStatus;
  /** Product version when first shipped */
  since: string;
  /** Persona who owns this feature */
  owner: string;
  /** Grouping: ai-tools | frontend | auth | pipeline | infra */
  category: string;
  /** Which spec doc this came from */
  spec_source: string;
  config?: { env?: Record<string, EnvConfig> };
  capabilities: FeatureCapability[];
  acceptance_criteria: AcceptanceCriterion[];
  changelog: ChangelogEntry[];
}

// --- Validation helpers ---

const VALID_ASSERTION_TYPES: ReadonlySet<string> = new Set(['invariant', 'behavioral', 'contract']);
const VALID_STATUSES: ReadonlySet<string> = new Set(['draft', 'active', 'shipped', 'graduated', 'deprecated']);
const SEMVER_RE = /^\d+\.\d+\.\d+$/;

export interface ValidationError {
  path: string;
  message: string;
}

/**
 * Validates a parsed YAML object against the FeatureManifest schema.
 * Returns an array of validation errors (empty = valid).
 */
export function validateManifest(data: unknown): ValidationError[] {
  const errors: ValidationError[] = [];
  if (typeof data !== 'object' || data === null) {
    errors.push({ path: '', message: 'Manifest must be a non-null object' });
    return errors;
  }

  const m = data as Record<string, unknown>;

  // Required string fields
  for (const field of ['feature', 'name', 'version', 'status', 'since', 'owner', 'category', 'spec_source']) {
    if (typeof m[field] !== 'string' || (m[field] as string).trim() === '') {
      errors.push({ path: field, message: `Required string field "${field}" is missing or empty` });
    }
  }

  // Feature ID format
  if (typeof m.feature === 'string' && !/^[a-z][a-z0-9-]*$/.test(m.feature)) {
    errors.push({ path: 'feature', message: 'Feature ID must be kebab-case (e.g., "giphy-integration")' });
  }

  // Version format
  if (typeof m.version === 'string' && !SEMVER_RE.test(m.version)) {
    errors.push({ path: 'version', message: 'Version must be SemVer (e.g., "1.0.0")' });
  }

  // Status
  if (typeof m.status === 'string' && !VALID_STATUSES.has(m.status)) {
    errors.push({ path: 'status', message: `Status must be one of: ${[...VALID_STATUSES].join(', ')}` });
  }

  // Capabilities
  if (!Array.isArray(m.capabilities)) {
    errors.push({ path: 'capabilities', message: 'capabilities must be an array' });
  } else {
    const assertionIds = new Set<string>();
    for (let i = 0; i < m.capabilities.length; i++) {
      const cap = m.capabilities[i] as Record<string, unknown>;
      const prefix = `capabilities[${i}]`;

      for (const field of ['id', 'name', 'version', 'description']) {
        if (typeof cap[field] !== 'string' || (cap[field] as string).trim() === '') {
          errors.push({ path: `${prefix}.${field}`, message: `Required string field "${field}" is missing or empty` });
        }
      }

      if (typeof cap.version === 'string' && !SEMVER_RE.test(cap.version)) {
        errors.push({ path: `${prefix}.version`, message: 'Capability version must be SemVer' });
      }

      if (!Array.isArray(cap.files)) {
        errors.push({ path: `${prefix}.files`, message: 'files must be an array' });
      }

      if (!Array.isArray(cap.assertions)) {
        errors.push({ path: `${prefix}.assertions`, message: 'assertions must be an array' });
      } else {
        for (let j = 0; j < cap.assertions.length; j++) {
          const a = cap.assertions[j] as Record<string, unknown>;
          const aPrefix = `${prefix}.assertions[${j}]`;

          if (typeof a.id !== 'string' || (a.id as string).trim() === '') {
            errors.push({ path: `${aPrefix}.id`, message: 'Assertion ID is required' });
          } else if (assertionIds.has(a.id as string)) {
            errors.push({ path: `${aPrefix}.id`, message: `Duplicate assertion ID: "${a.id}"` });
          } else {
            assertionIds.add(a.id as string);
          }

          if (typeof a.description !== 'string' || (a.description as string).trim() === '') {
            errors.push({ path: `${aPrefix}.description`, message: 'Assertion description is required' });
          }

          if (typeof a.type !== 'string' || !VALID_ASSERTION_TYPES.has(a.type as string)) {
            errors.push({ path: `${aPrefix}.type`, message: `Assertion type must be one of: ${[...VALID_ASSERTION_TYPES].join(', ')}` });
          }
        }
      }
    }
  }

  // Acceptance criteria
  if (!Array.isArray(m.acceptance_criteria)) {
    errors.push({ path: 'acceptance_criteria', message: 'acceptance_criteria must be an array' });
  } else {
    for (let i = 0; i < m.acceptance_criteria.length; i++) {
      const ac = m.acceptance_criteria[i] as Record<string, unknown>;
      const prefix = `acceptance_criteria[${i}]`;

      for (const field of ['id', 'title', 'gherkin']) {
        if (typeof ac[field] !== 'string' || (ac[field] as string).trim() === '') {
          errors.push({ path: `${prefix}.${field}`, message: `Required string field "${field}" is missing or empty` });
        }
      }

      if (!Array.isArray(ac.maps_to)) {
        errors.push({ path: `${prefix}.maps_to`, message: 'maps_to must be an array of assertion IDs' });
      }
    }
  }

  // Changelog
  if (!Array.isArray(m.changelog)) {
    errors.push({ path: 'changelog', message: 'changelog must be an array' });
  }

  return errors;
}
