import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DeletedItemType, RecycleBinStatus, Role } from '@prisma/client';

function isPrivileged(role: string) {
  return role === 'ADMIN' || role === 'SUPERADMIN';
}

@Injectable()
export class RecycleBinService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Scheduled purge: runs every day at midnight ──────────────────────────
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async purgeExpiredItems() {
    await this.prisma.deletedItem.updateMany({
      where: {
        status: RecycleBinStatus.ACTIVE,
        expiresAt: { lte: new Date() },
      },
      data: { status: RecycleBinStatus.PURGED },
    });
  }

  // ── List recycle bin ─────────────────────────────────────────────────────
  async list(callerId: string, callerRole: string) {
    if (isPrivileged(callerRole)) {
      return this.prisma.deletedItem.findMany({
        where: { status: RecycleBinStatus.ACTIVE },
        include: { deletedBy: { select: { id: true, fullName: true, email: true } } },
        orderBy: { deletedAt: 'desc' },
      });
    }
    // Members see only their own items
    return this.prisma.deletedItem.findMany({
      where: { status: RecycleBinStatus.ACTIVE, deletedById: callerId },
      include: { deletedBy: { select: { id: true, fullName: true, email: true } } },
      orderBy: { deletedAt: 'desc' },
    });
  }

  // ── Soft-delete an issue ─────────────────────────────────────────────────
  async softDeleteIssue(
    issueId: string,
    deletedById: string,
    callerRole: string,
    reason: string,
  ) {
    if (!reason?.trim()) throw new BadRequestException('A reason is required');

    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
      include: {
        createdBy: true,
        reporter: true,
        assignee: true,
        project: { include: { members: { include: { user: true } } } },
      },
    });
    if (!issue) throw new NotFoundException('Issue not found');

    // Superadmin-created items: only superadmin can delete
    if (issue.createdBy.role === Role.SUPERADMIN && callerRole !== 'SUPERADMIN') {
      throw new ForbiddenException('Only a superadmin can delete items created by the superadmin');
    }

    // Store snapshot
    const snapshot = {
      id: issue.id,
      title: issue.title,
      description: issue.description,
      type: issue.type,
      status: issue.status,
      priority: issue.priority,
      storyPoints: issue.storyPoints,
      deadline: issue.deadline,
      assigneeId: issue.assigneeId,
      reporterId: issue.reporterId,
      createdById: issue.createdById,
      projectId: issue.projectId,
      sprintId: issue.sprintId,
      backlogOrder: issue.backlogOrder,
      createdAt: issue.createdAt,
    };

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const deleted = await this.prisma.$transaction(async (tx) => {
      const di = await tx.deletedItem.create({
        data: {
          itemType: DeletedItemType.ISSUE,
          itemId: issueId,
          itemSnapshot: snapshot,
          deletedById,
          reason,
          expiresAt,
        },
      });
      await tx.issue.delete({ where: { id: issueId } });
      return di;
    });

    // Notify creator (or all project members if creator is gone)
    await this._notifyDeletion('ISSUE', issue.title, reason, issue.createdBy, issue.project.members.map(m => m.user), deletedById);

    return deleted;
  }

  // ── Soft-delete a project ────────────────────────────────────────────────
  async softDeleteProject(
    projectId: string,
    deletedById: string,
    callerRole: string,
    reason: string,
  ) {
    if (!reason?.trim()) throw new BadRequestException('A reason is required');

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        createdBy: true,
        members: { include: { user: true } },
        issues: { include: { comments: true } },
        sprints: true,
        team: true,
      },
    });
    if (!project) throw new NotFoundException('Project not found');

    if (project.createdBy.role === Role.SUPERADMIN && callerRole !== 'SUPERADMIN') {
      throw new ForbiddenException('Only a superadmin can delete items created by the superadmin');
    }

    const snapshot = {
      id: project.id,
      name: project.name,
      description: project.description,
      teamId: project.teamId,
      createdById: project.createdById,
      createdAt: project.createdAt,
      members: project.members.map(m => ({ userId: m.userId })),
      sprints: project.sprints,
      issues: project.issues,
    };

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const deleted = await this.prisma.$transaction(async (tx) => {
      const di = await tx.deletedItem.create({
        data: {
          itemType: DeletedItemType.PROJECT,
          itemId: projectId,
          itemSnapshot: snapshot,
          deletedById,
          reason,
          expiresAt,
        },
      });
      await tx.project.delete({ where: { id: projectId } });
      return di;
    });

    await this._notifyDeletion('PROJECT', project.name, reason, project.createdBy, project.members.map(m => m.user), deletedById);

    return deleted;
  }

  // ── Soft-delete a team ───────────────────────────────────────────────────
  async softDeleteTeam(
    teamId: string,
    deletedById: string,
    callerRole: string,
    reason: string,
  ) {
    if (!reason?.trim()) throw new BadRequestException('A reason is required');

    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        createdBy: true,
        members: { include: { user: true } },
        projects: true,
      },
    });
    if (!team) throw new NotFoundException('Team not found');

    if (team.createdBy.role === Role.SUPERADMIN && callerRole !== 'SUPERADMIN') {
      throw new ForbiddenException('Only a superadmin can delete items created by the superadmin');
    }

    const snapshot = {
      id: team.id,
      name: team.name,
      description: team.description,
      createdById: team.createdById,
      createdAt: team.createdAt,
      members: team.members.map(m => ({ userId: m.userId })),
      projects: team.projects.map(p => p.id),
    };

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const deleted = await this.prisma.$transaction(async (tx) => {
      const di = await tx.deletedItem.create({
        data: {
          itemType: DeletedItemType.TEAM,
          itemId: teamId,
          itemSnapshot: snapshot,
          deletedById,
          reason,
          expiresAt,
        },
      });
      await tx.team.delete({ where: { id: teamId } });
      return di;
    });

    await this._notifyDeletion('TEAM', team.name, reason, team.createdBy, team.members.map(m => m.user), deletedById);

    return deleted;
  }

  // ── Restore an item (admin/superadmin) ───────────────────────────────────
  async restore(deletedItemId: string, callerId: string, callerRole: string) {
    const item = await this.prisma.deletedItem.findUnique({
      where: { id: deletedItemId },
    });
    if (!item) throw new NotFoundException('Deleted item not found');
    if (item.status !== RecycleBinStatus.ACTIVE) {
      throw new BadRequestException('Item is no longer available for restore');
    }

    const snap = item.itemSnapshot as any;

    if (item.itemType === DeletedItemType.ISSUE) {
      await this._restoreIssue(snap);
    } else if (item.itemType === DeletedItemType.PROJECT) {
      await this._restoreProject(snap);
    } else if (item.itemType === DeletedItemType.TEAM) {
      await this._restoreTeam(snap);
    }

    await this.prisma.deletedItem.update({
      where: { id: deletedItemId },
      data: { status: RecycleBinStatus.RESTORED, restoredAt: new Date() },
    });

    return { message: 'Item restored successfully' };
  }

  // ── Hard delete (permanent, admin/superadmin only) ───────────────────────
  async hardDelete(deletedItemId: string) {
    const item = await this.prisma.deletedItem.findUnique({ where: { id: deletedItemId } });
    if (!item) throw new NotFoundException('Deleted item not found');
    await this.prisma.deletedItem.update({
      where: { id: deletedItemId },
      data: { status: RecycleBinStatus.PURGED },
    });
    return { message: 'Item permanently deleted' };
  }

  // ── Private helpers ──────────────────────────────────────────────────────
  private async _notifyDeletion(
    itemType: string,
    itemName: string,
    reason: string,
    creator: any,
    members: any[],
    deletedById: string,
  ) {
    const deleter = await this.prisma.user.findUnique({ where: { id: deletedById }, select: { fullName: true } });
    const deleterName = deleter?.fullName ?? 'An administrator';

    const recipients = creator?.isActive ? [creator] : members.filter(m => m.isActive && m.id !== deletedById);

    for (const recipient of recipients) {
      await this.notifications.create({
        userId: recipient.id,
        type: 'DELETION_NOTICE',
        title: `${itemType} deleted`,
        message: `${deleterName} deleted ${itemType.toLowerCase()} "${itemName}". Reason: ${reason}`,
      });

      void this.email.send({
        to: recipient.email,
        subject: `Your ${itemType.toLowerCase()} "${itemName}" was deleted`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
            <h2 style="color:#111;margin-top:0;">${itemType} Deleted</h2>
            <p style="color:#444;line-height:1.6;">Hi ${recipient.fullName},</p>
            <p style="color:#444;line-height:1.6;">
              <strong>${deleterName}</strong> has deleted the ${itemType.toLowerCase()} 
              "<strong>${itemName}</strong>".
            </p>
            <div style="background:#f5f5f5;border-radius:8px;padding:16px 20px;margin:20px 0;">
              <p style="margin:0 0 4px;color:#666;font-size:13px;text-transform:uppercase;">Reason</p>
              <p style="margin:0;color:#111;">${this.escapeHtml(reason)}</p>
            </div>
            <p style="color:#444;line-height:1.6;">
              This item has been moved to the recycle bin and can be restored within 30 days.
            </p>
            <div style="text-align:center;margin:28px 0;">
              <a href="https://trackr.ubwengelab.rw/recycle-bin"
                 style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;
                        padding:12px 28px;border-radius:8px;font-size:15px;font-weight:600;">
                View Recycle Bin
              </a>
            </div>
          </div>`,
      });
    }
  }

  private async _restoreIssue(snap: any) {
    await this.prisma.issue.create({
      data: {
        id: snap.id,
        title: snap.title,
        description: snap.description,
        type: snap.type,
        status: snap.status,
        priority: snap.priority,
        storyPoints: snap.storyPoints,
        deadline: snap.deadline ? new Date(snap.deadline) : null,
        assigneeId: snap.assigneeId,
        reporterId: snap.reporterId,
        createdById: snap.createdById,
        projectId: snap.projectId,
        sprintId: snap.sprintId,
        backlogOrder: snap.backlogOrder,
        createdAt: new Date(snap.createdAt),
      },
    });
  }

  private async _restoreProject(snap: any) {
    // Guard: if the project's team was also deleted, sever the team link to avoid FK failure
    let safeTeamId: string | null = snap.teamId ?? null;
    if (safeTeamId) {
      const teamExists = await this.prisma.team.findUnique({ where: { id: safeTeamId }, select: { id: true } });
      if (!teamExists) safeTeamId = null;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.project.create({
        data: {
          id: snap.id,
          name: snap.name,
          description: snap.description,
          teamId: safeTeamId,
          createdById: snap.createdById,
          createdAt: new Date(snap.createdAt),
          members: { create: snap.members ?? [] },
        },
      });

      // Restore sprints
      if (snap.sprints?.length) {
        for (const sprint of snap.sprints) {
          await tx.sprint.create({
            data: {
              id: sprint.id,
              name: sprint.name,
              projectId: snap.id,
              startDate: sprint.startDate ? new Date(sprint.startDate) : null,
              endDate: sprint.endDate ? new Date(sprint.endDate) : null,
              status: sprint.status,
              createdAt: new Date(sprint.createdAt),
            },
          });
        }
      }

      // Restore issues (and their comments)
      if (snap.issues?.length) {
        for (const issue of snap.issues) {
          await tx.issue.create({
            data: {
              id: issue.id,
              title: issue.title,
              description: issue.description,
              type: issue.type,
              status: issue.status,
              priority: issue.priority,
              storyPoints: issue.storyPoints,
              deadline: issue.deadline ? new Date(issue.deadline) : null,
              assigneeId: issue.assigneeId,
              reporterId: issue.reporterId,
              createdById: issue.createdById,
              projectId: snap.id,
              sprintId: issue.sprintId,
              backlogOrder: issue.backlogOrder,
              createdAt: new Date(issue.createdAt),
            },
          });

          if (issue.comments?.length) {
            for (const comment of issue.comments) {
              await tx.comment.create({
                data: {
                  id: comment.id,
                  issueId: issue.id,
                  authorId: comment.authorId,
                  body: comment.body,
                  createdAt: new Date(comment.createdAt),
                },
              });
            }
          }
        }
      }
    });
  }

  private async _restoreTeam(snap: any) {
    await this.prisma.$transaction(async (tx) => {
      await tx.team.create({
        data: {
          id: snap.id,
          name: snap.name,
          description: snap.description,
          createdById: snap.createdById,
          createdAt: new Date(snap.createdAt),
          members: { create: snap.members ?? [] },
        },
      });

      // Re-link any projects that already exist in the DB but lost their teamId
      if (snap.projects?.length) {
        await tx.project.updateMany({
          where: { id: { in: snap.projects } },
          data: { teamId: snap.id },
        });
      }
    });
  }
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

}
