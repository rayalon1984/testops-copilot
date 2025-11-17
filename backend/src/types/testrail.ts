/**
 * TestRail API Types
 * Official API documentation: https://www.gurock.com/testrail/docs/api
 */

export interface TestRailProject {
  id: number;
  name: string;
  announcement: string;
  show_announcement: boolean;
  is_completed: boolean;
  completed_on: number | null;
  suite_mode: number;
  url: string;
}

export interface TestRailSuite {
  id: number;
  name: string;
  description: string;
  project_id: number;
  is_master: boolean;
  is_baseline: boolean;
  is_completed: boolean;
  completed_on: number | null;
  url: string;
}

export interface TestRailSection {
  id: number;
  suite_id: number;
  name: string;
  description: string;
  parent_id: number | null;
  display_order: number;
  depth: number;
}

export interface TestRailCase {
  id: number;
  title: string;
  section_id: number;
  template_id: number;
  type_id: number;
  priority_id: number;
  milestone_id: number | null;
  refs: string | null;
  created_by: number;
  created_on: number;
  updated_by: number;
  updated_on: number;
  estimate: string | null;
  estimate_forecast: string | null;
  suite_id: number;
  custom_fields?: Record<string, any>;
}

export interface TestRailRun {
  id: number;
  suite_id: number;
  name: string;
  description: string;
  milestone_id: number | null;
  assignedto_id: number | null;
  include_all: boolean;
  is_completed: boolean;
  completed_on: number | null;
  config: string | null;
  config_ids: number[];
  passed_count: number;
  blocked_count: number;
  untested_count: number;
  retest_count: number;
  failed_count: number;
  custom_status1_count: number;
  custom_status2_count: number;
  custom_status3_count: number;
  custom_status4_count: number;
  custom_status5_count: number;
  custom_status6_count: number;
  custom_status7_count: number;
  project_id: number;
  plan_id: number | null;
  created_on: number;
  created_by: number;
  url: string;
}

export interface TestRailTest {
  id: number;
  case_id: number;
  status_id: number;
  assignedto_id: number | null;
  run_id: number;
  title: string;
  template_id: number;
  type_id: number;
  priority_id: number;
  estimate: string | null;
  estimate_forecast: string | null;
  refs: string | null;
  milestone_id: number | null;
  custom_fields?: Record<string, any>;
}

export interface TestRailResult {
  id: number;
  test_id: number;
  status_id: number;
  created_by: number;
  created_on: number;
  assignedto_id: number | null;
  comment: string;
  version: string | null;
  elapsed: string | null;
  defects: string | null;
  custom_fields?: Record<string, any>;
}

export interface TestRailMilestone {
  id: number;
  name: string;
  description: string;
  start_on: number | null;
  started_on: number | null;
  is_started: boolean;
  due_on: number | null;
  is_completed: boolean;
  completed_on: number | null;
  project_id: number;
  parent_id: number | null;
  refs: string | null;
  url: string;
}

export interface TestRailPlan {
  id: number;
  name: string;
  description: string;
  milestone_id: number | null;
  assignedto_id: number | null;
  is_completed: boolean;
  completed_on: number | null;
  passed_count: number;
  blocked_count: number;
  untested_count: number;
  retest_count: number;
  failed_count: number;
  custom_status1_count: number;
  custom_status2_count: number;
  custom_status3_count: number;
  custom_status4_count: number;
  custom_status5_count: number;
  custom_status6_count: number;
  custom_status7_count: number;
  project_id: number;
  created_on: number;
  created_by: number;
  url: string;
  entries: TestRailPlanEntry[];
}

export interface TestRailPlanEntry {
  id: string;
  suite_id: number;
  name: string;
  description: string;
  assignedto_id: number | null;
  include_all: boolean;
  case_ids: number[];
  config_ids: number[];
  runs: TestRailRun[];
}

export interface TestRailUser {
  id: number;
  name: string;
  email: string;
  is_active: boolean;
  role_id: number;
  role: string;
}

export interface TestRailStatus {
  id: number;
  name: string;
  label: string;
  color_dark: number;
  color_medium: number;
  color_bright: number;
  is_system: boolean;
  is_untested: boolean;
  is_final: boolean;
}

// Standard TestRail Status IDs
export enum TestRailStatusId {
  PASSED = 1,
  BLOCKED = 2,
  UNTESTED = 3,
  RETEST = 4,
  FAILED = 5,
}

// DTOs for API requests
export interface CreateTestRunRequest {
  suite_id: number;
  name: string;
  description?: string;
  milestone_id?: number;
  assignedto_id?: number;
  include_all?: boolean;
  case_ids?: number[];
  refs?: string;
}

export interface UpdateTestRunRequest {
  name?: string;
  description?: string;
  milestone_id?: number;
  assignedto_id?: number;
  include_all?: boolean;
  case_ids?: number[];
}

export interface AddTestResultRequest {
  status_id: number;
  comment?: string;
  version?: string;
  elapsed?: string;
  defects?: string;
  assignedto_id?: number;
  custom_fields?: Record<string, any>;
}

export interface AddTestResultsRequest {
  results: Array<{
    test_id?: number;
    case_id?: number;
    status_id: number;
    comment?: string;
    version?: string;
    elapsed?: string;
    defects?: string;
    assignedto_id?: number;
    custom_fields?: Record<string, any>;
  }>;
}

export interface CreateTestCaseRequest {
  title: string;
  template_id?: number;
  type_id?: number;
  priority_id?: number;
  estimate?: string;
  milestone_id?: number;
  refs?: string;
  custom_fields?: Record<string, any>;
}

export interface UpdateTestCaseRequest {
  title?: string;
  template_id?: number;
  type_id?: number;
  priority_id?: number;
  estimate?: string;
  milestone_id?: number;
  refs?: string;
  custom_fields?: Record<string, any>;
}

// TestRail Configuration
export interface TestRailConfig {
  baseUrl: string;
  username: string;
  apiKey: string;
  projectId?: number;
  enabled?: boolean;
}

// Error response
export interface TestRailError {
  error: string;
}
