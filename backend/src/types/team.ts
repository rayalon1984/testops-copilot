/**
 * Team workspace types
 */

export enum TeamRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  VIEWER = 'VIEWER',
}

/** Role hierarchy for permission checks (higher number = more privilege) */
export const TEAM_ROLE_HIERARCHY: Record<string, number> = {
  [TeamRole.VIEWER]: 0,
  [TeamRole.MEMBER]: 1,
  [TeamRole.ADMIN]: 2,
  [TeamRole.OWNER]: 3,
};

export interface CreateTeamInput {
  name: string;
  slug: string;
  description?: string;
}

export interface UpdateTeamInput {
  name?: string;
  description?: string;
}

export interface AddTeamMemberInput {
  userId: string;
  role?: TeamRole;
}

export interface TeamWithRole {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  role: string;
  memberCount: number;
}

export interface TeamMemberDTO {
  id: string;
  userId: string;
  role: string;
  joinedAt: Date;
}
