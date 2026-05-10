import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminHash = await bcrypt.hash('admin123', 10);
  const memberHash = await bcrypt.hash('member123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: { email: 'admin@example.com', passwordHash: adminHash, fullName: 'Admin User', role: Role.ADMIN },
  });

  const member = await prisma.user.upsert({
    where: { email: 'member@example.com' },
    update: {},
    create: { email: 'member@example.com', passwordHash: memberHash, fullName: 'Team Member', role: Role.MEMBER },
  });

  // Third user intentionally NOT added to the team or project.
  // Use this account to test that non-members are correctly blocked from project routes.
  await prisma.user.upsert({
    where: { email: 'memberb@example.com' },
    update: {},
    create: { email: 'memberb@example.com', passwordHash: memberHash, fullName: 'Member B', role: Role.MEMBER },
  });

  const team = await prisma.team.upsert({
    where: { name: 'Engineering' },
    update: {},
    create: {
      name: 'Engineering',
      description: 'Core engineering team',
      createdById: admin.id,
      members: { create: [{ userId: admin.id }, { userId: member.id }] },
    },
  });

  // Find or create the project so repeated seed runs don't duplicate it.
  // Project has no @unique constraint on name, so we use findFirst + create.
  let project = await prisma.project.findFirst({
    where: { name: 'Issue Tracker MVP' },
  });
  if (!project) {
    project = await prisma.project.create({
      data: {
        name: 'Issue Tracker MVP',
        description: 'Internal issue tracker project',
        teamId: team.id,
        createdById: admin.id,
        members: { create: [{ userId: admin.id }, { userId: member.id }] },
      },
    });
  } else {
    // Ensure the team link is up-to-date on re-runs
    await prisma.project.update({
      where: { id: project.id },
      data: { teamId: team.id },
    });
    // Upsert membership so we don't create duplicates if members already exist
    for (const userId of [admin.id, member.id]) {
      await prisma.projectMember.upsert({
        where: { projectId_userId: { projectId: project.id, userId } },
        update: {},
        create: { projectId: project.id, userId },
      });
    }
  }

  // Only seed issues when the project was freshly created (i.e. no issues yet).
  // This prevents duplicate seed issues accumulating on repeated runs.
  const existingIssueCount = await prisma.issue.count({ where: { projectId: project.id } });
  if (existingIssueCount === 0) {
    await prisma.issue.createMany({
      data: [
        {
          title: 'Set up CI/CD pipeline',
          description: 'Configure GitHub Actions for automated testing and deployment.',
          type: 'TASK',
          status: 'IN_PROGRESS',
          priority: 'HIGH',
          reporterId: admin.id,
          createdById: admin.id,
          assigneeId: member.id,
          projectId: project.id,
        },
        {
          title: 'Login page throws 500 on empty password',
          description: 'When submitting with an empty password, the API returns 500 instead of 400.',
          type: 'BUG',
          status: 'TODO',
          priority: 'HIGH',
          reporterId: member.id,
          createdById: member.id,
          assigneeId: admin.id,
          projectId: project.id,
        },
        {
          title: 'Filter issues by status',
          description: 'Add filter controls to the issue list.',
          type: 'STORY',
          status: 'TODO',
          priority: 'MEDIUM',
          reporterId: admin.id,
          createdById: admin.id,
          projectId: project.id,
        },
      ],
    });
  }

  console.log('Seed complete.');
  console.log('Admin:    admin@example.com   / admin123');
  console.log('Member:   member@example.com  / member123');
  console.log('Member B: memberb@example.com / member123  (not in any project — use for permission tests)');
}

main().catch(console.error).finally(() => prisma.$disconnect());
