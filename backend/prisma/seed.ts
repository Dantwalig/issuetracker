import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminHash = await bcrypt.hash('admin123', 10);
  const memberHash = await bcrypt.hash('member123', 10);

  const admin1 = await prisma.user.upsert({
    where: { email: 't.niyonkuru@ubwengelab.rw' },
    update: {},
    create: { email: 't.niyonkuru@ubwengelab.rw', passwordHash: adminHash, fullName: 'Niyonkuru Mitali Tony Robert', role: Role.ADMIN },
  });

  const admin2 = await prisma.user.upsert({
    where: { email: 'a.bwiza@ubwengelab.rw' },
    update: {},
    create: { email: 'a.bwiza@ubwengelab.rw', passwordHash: adminHash, fullName: 'Annie Pierre Bwiza', role: Role.ADMIN },
  });

  const admin3 = await prisma.user.upsert({
    where: { email: 'd.ntwali@ubwengelab.rw' },
    update: {},
    create: { email: 'd.ntwali@ubwengelab.rw', passwordHash: adminHash, fullName: 'Daniel Gakumba Ntwali', role: Role.ADMIN },
  });

  const admin4 = await prisma.user.upsert({
    where: { email: 's.umuhire@ubwengelab.rw' },
    update: {},
    create: { email: 's.umuhire@ubwengelab.rw', passwordHash: adminHash, fullName: 'Samantha Umuhire Ineza', role: Role.ADMIN },
  });

  const admin5 = await prisma.user.upsert({
    where: { email: 't.butera@ubwengelab.rw' },
    update: {},
    create: { email: 't.butera@ubwengelab.rw', passwordHash: adminHash, fullName: 'Teta Butera Nelly', role: Role.ADMIN },
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
      members: { create: [{ userId: admin1.id }, { userId: admin2.id }, { userId: admin3.id }, { userId: admin4.id }, { userId: admin5.id }, { userId: member.id }] },
    },
  });

  // Find or create the project so repeated seed runs don't duplicate it.
  let project = await prisma.project.findFirst({
    where: { name: 'Issue Tracker MVP' },
  });
  if (!project) {
    project = await prisma.project.create({
      data: {
        name: 'Issue Tracker MVP',
        description: 'Internal issue tracker project',
        teamId: team.id,
        members: { create: [{ userId: admin1.id }, { userId: admin2.id }, { userId: admin3.id }, { userId: admin4.id }, { userId: admin5.id }, { userId: member.id }] },
      },
    });
  } else {
    await prisma.project.update({
      where: { id: project.id },
      data: { teamId: team.id },
    });
    for (const userId of [admin1.id, admin2.id, admin3.id, admin4.id, admin5.id, member.id]) {
      await prisma.projectMember.upsert({
        where: { projectId_userId: { projectId: project.id, userId } },
        update: {},
        create: { projectId: project.id, userId },
      });
    }
  }

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
          reporterId: admin1.id,
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
          assigneeId: admin1.id,
          projectId: project.id,
        },
        {
          title: 'Filter issues by status',
          description: 'Add filter controls to the issue list.',
          type: 'STORY',
          status: 'TODO',
          priority: 'MEDIUM',
          reporterId: admin1.id,
          projectId: project.id,
        },
      ],
    });
  }

  console.log('✅ Seed complete.');
  console.log('Admins added:');
  console.log('  t.niyonkuru@ubwengelab.rw');
  console.log('  a.bwiza@ubwengelab.rw');
  console.log('  d.ntwali@ubwengelab.rw');
  console.log('  s.umuhire@ubwengelab.rw');
  console.log('  t.butera@ubwengelab.rw');
  console.log('  (All admins have password: admin123)');
  console.log('');
  console.log('Member:   member@example.com  / member123');
  console.log('Member B: memberb@example.com / member123  (not in any project)');
}

main().catch(console.error).finally(() => prisma.$disconnect());
