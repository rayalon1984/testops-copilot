/**
 * Monday.com Integration Types
 *
 * Type definitions for Monday.com Work OS integration
 * API Reference: https://developer.monday.com/api-reference/docs
 */

export interface MondayConfig {
  apiToken: string;
  apiUrl?: string;
  boardId?: string;
  workspaceId?: string;
}

export interface MondayBoard {
  id: string;
  name: string;
  description?: string;
  state: 'active' | 'archived' | 'deleted';
  board_kind: 'public' | 'private' | 'share';
  workspace_id?: string;
}

export interface MondayColumn {
  id: string;
  title: string;
  type: string;
  settings_str?: string;
}

export interface MondayGroup {
  id: string;
  title: string;
  color?: string;
  position?: string;
}

export interface MondayItem {
  id: string;
  name: string;
  state?: 'active' | 'archived' | 'deleted';
  column_values?: MondayColumnValue[];
  group?: MondayGroup;
  board?: {
    id: string;
  };
  creator?: {
    id: string;
    name: string;
  };
  created_at?: string;
  updated_at?: string;
}

export interface MondayColumnValue {
  id: string;
  title: string;
  type: string;
  text?: string;
  value?: string;
}

export interface MondayUpdate {
  id: string;
  body: string;
  creator?: {
    id: string;
    name: string;
  };
  created_at?: string;
}

export interface CreateMondayItemInput {
  boardId: string;
  groupId?: string;
  itemName: string;
  columnValues?: Record<string, unknown>;
}

export interface UpdateMondayItemInput {
  itemId: string;
  boardId: string;
  columnValues?: Record<string, unknown>;
}

export interface CreateMondayUpdateInput {
  itemId: string;
  body: string;
}

export interface MondayTestFailureInput {
  testRunId: string;
  testName: string;
  errorMessage: string;
  stackTrace?: string;
  boardId: string;
  groupId?: string;
}

export interface MondayQueryResponse<T> {
  data: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
  }>;
}

export interface MondayBoardsResponse {
  boards: MondayBoard[];
}

export interface MondayItemResponse {
  create_item?: MondayItem;
  items?: MondayItem[];
}

export interface MondayUpdateResponse {
  create_update?: MondayUpdate;
}

export interface MondayItemColumn {
  columnId: string;
  value: string | number | boolean | object;
}

// Column type helpers
export type MondayStatusValue = {
  label: string;
  index?: number;
};

export type MondayPeopleValue = {
  personsAndTeams: Array<{ id: string; kind: 'person' | 'team' }>;
};

export type MondayDateValue = {
  date: string; // ISO format: YYYY-MM-DD
  time?: string; // HH:MM:SS
};

export type MondayTextValue = string;

export type MondayNumberValue = number;

export type MondayLinkValue = {
  url: string;
  text?: string;
};

// Utility type for column value formatting
export type MondayColumnValueInput =
  | MondayStatusValue
  | MondayPeopleValue
  | MondayDateValue
  | MondayTextValue
  | MondayNumberValue
  | MondayLinkValue;
