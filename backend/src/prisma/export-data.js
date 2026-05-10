const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  const teams = await prisma.team.findMany({ include: { members: true } });
  const projects = await prisma.project.findMany({ include: { members: true } });
  const issues = await prisma.issue.findMany();
  const comments = await prisma.comment.findMany();
  const activityLogs = await prisma.activityLog.findMany();

  const data = { users, teams, projects, issues, comments, activityLogs };
  fs.writeFileSync('C:/Users/Richter Richard NAHO/Documents/Trackr_Recovery_Files/database_live_export.json', JSON.stringify(data, null, 2));
  console.log('✅ Live database backup created successfully.');
}

main().catch(console.error).finally(() => prisma.$disconnect());