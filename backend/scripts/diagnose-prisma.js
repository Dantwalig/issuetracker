/**
 * Diagnose Prisma/DB health for the exact query shapes that broke after the
 * completedAt schema experiment (include-based queries emit every column, so
 * they fail when the generated client is ahead of the database).
 *
 * READ-ONLY — only runs SELECT-style probes. No writes.
 *
 * Usage (from backend/):
 *   node scripts/diagnose-prisma.js
 *
 * Expected: "ALL PROBES PASS — client and DB are in sync"
 * If any probe FAILs, the message above it is the real error — paste it whole.
 */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const probes = [
  ['sprint include-query (my-work shape)', () => p.sprint.findMany({ include: { issues: true }, take: 1 })],
  ['issue include-query (labels/checklists/comments shape)', () => p.issue.findFirst({ include: { comments: true, labels: true } })],
  ['project include-query (backlog/board shape)', () => p.project.findFirst({ include: { issues: true, sprints: true } })],
  ['user count (auth path)', () => p.user.count()],
];

(async () => {
  let fails = 0;
  for (const [name, fn] of probes) {
    try {
      await fn();
      console.log(`PASS  ${name}`);
    } catch (e) {
      fails++;
      console.error(`FAIL  ${name}`);
      console.error(
        String(e.message)
          .split('\n')
          .slice(0, 5)
          .join('\n'),
      );
    }
  }
  await p.$disconnect();
  console.log(
    fails === 0
      ? '\nALL PROBES PASS — client and DB are in sync'
      : `\n${fails} PROBE(S) FAILED — see messages above`,
  );
  process.exit(fails === 0 ? 0 : 1);
})();
