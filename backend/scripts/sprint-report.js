/**
 * Read-only sprint & backlog health report for Trackr.
 *
 * Usage (from backend/):
 *   node --env-file=.env scripts/sprint-report.js
 *
 * Prints one section per project: sprint status, dates, issue counts,
 * story-point totals per status, and delivered SP for completed sprints
 * (velocity baseline). NEVER writes to the database — reads only.
 *
 * Caveat: delivered SP is approximated from issues that are currently DONE
 * and still linked to the sprint (completeSprint only returns unfinished
 * issues to the backlog). This is why the analytics sprint adds `completedAt`
 * — see SPRINT_PLAN_ANALYTICS.md.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SP = (i) => i.storyPoints ?? 0;
const day = (d) => (d ? d.toISOString().slice(0, 10) : '—');

async function main() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true },
  });

  if (projects.length === 0) {
    console.log('No projects found.');
    return;
  }

  let grandTotal = 0;

  for (const project of projects) {
    console.log(`\n${'='.repeat(72)}`);
    console.log(`PROJECT: ${project.name} (${project.id})`);
    console.log(`${'='.repeat(72)}`);

    const sprints = await prisma.sprint.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: 'asc' },
      include: {
        issues: { select: { id: true, status: true, storyPoints: true } },
      },
    });

    const backlog = await prisma.issue.findMany({
      where: { projectId: project.id, sprintId: null },
      select: { status: true, storyPoints: true },
    });

    for (const sprint of sprints) {
      const issues = sprint.issues;
      const total = issues.length;
      const done = issues.filter((i) => i.status === 'DONE');
      const inProg = issues.filter((i) => i.status === 'IN_PROGRESS');
      const todo = issues.filter((i) => i.status === 'TODO');
      const spTotal = issues.reduce((s, i) => s + SP(i), 0);
      const spDone = done.reduce((s, i) => s + SP(i), 0);
      const spInProg = inProg.reduce((s, i) => s + SP(i), 0);
      const spTodo = todo.reduce((s, i) => s + SP(i), 0);
      const pct = spTotal === 0 ? 0 : Math.round((spDone / spTotal) * 100);

      console.log(`\n  Sprint: ${sprint.name} [${sprint.status}]`);
      console.log(
        `    Dates:    ${day(sprint.startDate)} → ${day(sprint.endDate)}`,
      );
      console.log(
        `    Issues:   ${total} total | ${todo.length} todo | ${inProg.length} in-progress | ${done.length} done`,
      );
      console.log(
        `    Points:   ${spTotal} SP total | ${spDone} SP done (${pct}%) | ${spInProg} SP in-progress | ${spTodo} SP todo`,
      );
      if (sprint.status === 'COMPLETED') {
        console.log(`    Velocity: ${spDone} SP delivered (baseline)`);
      }
    }

    const spBacklog = backlog.reduce((s, i) => s + SP(i), 0);
    console.log(
      `\n  Backlog: ${backlog.length} issues | ${spBacklog} SP total`,
    );
    grandTotal += spBacklog;
  }

  console.log(`\n${'='.repeat(72)}`);
  console.log(`TOTAL backlog SP across all projects: ${grandTotal}`);
  console.log(`${'='.repeat(72)}`);
}

main()
  .catch((err) => {
    console.error('Report failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
