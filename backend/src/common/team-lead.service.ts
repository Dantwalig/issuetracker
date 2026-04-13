/**
 * TeamLeadService
 *
 * Provides scoped Team Lead permission checks.
 * Team Lead is NOT a global role — it lives on ProjectMember.scopedRole
 * or TeamMember.scopedRole as the string "TEAM_LEAD".
 *
 * All checks are read-only queries against existing tables.
 * Nothing here modifies the User.role field.
 *
 * Note: `as any` casts below are intentional — they allow the code to compile
 * before `prisma generate` has been run with the latest schema (which adds
 * `scopedRole` to the generated types). After running `prisma generate` the
 * casts are harmless.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const TEAM_LEAD_ROLE = 'TEAM_LEAD';

@Injectable()
export class TeamLeadService {
  constructor(private readonly prisma: PrismaService) {}

  /** True when the user is a Team Lead for the given project. */
  async isProjectTeamLead(userId: string, projectId: string): Promise<boolean> {
    const membership = await (this.prisma.projectMember.findUnique as any)({
      where: { projectId_userId: { projectId, userId } },
      select: { scopedRole: true },
    });
    return membership?.scopedRole === TEAM_LEAD_ROLE;
  }

  /** True when the user is a Team Lead for the given team. */
  async isTeamTeamLead(userId: string, teamId: string): Promise<boolean> {
    const membership = await (this.prisma.teamMember.findUnique as any)({
      where: { teamId_userId: { teamId, userId } },
      select: { scopedRole: true },
    });
    return membership?.scopedRole === TEAM_LEAD_ROLE;
  }

  /**
   * True when the user is a Team Lead for the project an issue belongs to.
   * Resolves the projectId from the issue automatically.
   */
  async isTeamLeadForIssue(userId: string, issueId: string): Promise<boolean> {
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
      select: { projectId: true },
    });
    if (!issue) return false;
    return this.isProjectTeamLead(userId, issue.projectId);
  }

  /**
   * True when the user is a Team Lead for the project a sprint belongs to.
   */
  async isTeamLeadForSprint(userId: string, sprintId: string): Promise<boolean> {
    const sprint = await this.prisma.sprint.findUnique({
      where: { id: sprintId },
      select: { projectId: true },
    });
    if (!sprint) return false;
    return this.isProjectTeamLead(userId, sprint.projectId);
  }

  // ── Promote / demote helpers (used by admin endpoints) ──────────────────

  async setProjectTeamLead(projectId: string, userId: string): Promise<void> {
    await (this.prisma.projectMember.update as any)({
      where: { projectId_userId: { projectId, userId } },
      data: { scopedRole: TEAM_LEAD_ROLE },
    });
  }

  async removeProjectTeamLead(projectId: string, userId: string): Promise<void> {
    await (this.prisma.projectMember.update as any)({
      where: { projectId_userId: { projectId, userId } },
      data: { scopedRole: null },
    });
  }

  async setTeamTeamLead(teamId: string, userId: string): Promise<void> {
    await (this.prisma.teamMember.update as any)({
      where: { teamId_userId: { teamId, userId } },
      data: { scopedRole: TEAM_LEAD_ROLE },
    });
  }

  async removeTeamTeamLead(teamId: string, userId: string): Promise<void> {
    await (this.prisma.teamMember.update as any)({
      where: { teamId_userId: { teamId, userId } },
      data: { scopedRole: null },
    });
  }
}
