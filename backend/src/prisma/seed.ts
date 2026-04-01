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

  const team = await prisma.team.upsert({
    where: { name: 'Engineering' },
    update: {},
    create: {
      name: 'Engineering',
      description: 'Core engineering team',
      members: { create: [{ userId: admin.id }, { userId: member.id }] },
    },
  });

  const project = await prisma.project.create({
    data: {
      name: 'Issue Tracker MVP',
      description: 'Internal issue tracker project',
      teamId: team.id,
      members: { create: [{ userId: admin.id }, { userId: member.id }] },
    },
  });

  await prisma.issue.createMany({
    data: [
      {
        title: 'Set up CI/CD pipeline',
        description: 'Configure GitHub Actions for automated testing and deployment.',
        type: 'TASK',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        reporterId: admin.id,
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
        projectId: project.id,
      },
    ],
    skipDuplicates: true,
  });

  console.log('Seed complete.');
  console.log('Admin:  admin@example.com  / admin123');
  console.log('Member: member@example.com / member123');
}

main().catch(console.error).finally(() => prisma.$disconnect());
