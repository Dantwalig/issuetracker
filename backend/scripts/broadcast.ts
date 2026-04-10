import { PrismaClient, NotificationType } from '@prisma/client';

const prisma = new PrismaClient();

const MESSAGE_BODY = `**Hello! Here are the development guidelines and testing credentials for your assignment in this sprint.**

**1. Local Setup & Running the App**
Please ensure you pull the latest changes from \`main\` before doing anything. 
* **Install:** Run \`npm install\` in both the frontend and backend directories.
* **Build:** Run \`npm run build\` in both directories to ensure there are no compilation errors.
* **Start Backend:** \`npm run start:dev\`
* **Start Frontend:** \`npm run dev\` *(Note: If you run \`npm run start\` on the frontend, you must make sure the build was successful first, but \`npm run dev\` is best for active coding).*

**2. Test Credentials**
Use the following credentials to test your implementations based on the role you are interacting with:
* **Pharmacy Owner:** Email: owner@medplus.com, Password: Test@1234
* **Branch Manager:** Email: manager@medplus.com, Password: Test@1234
* **Staff Pharmacist:** Email: pharmacist@medplus.com, Password: Test@1234
* **Cashier:** Email: cashier@medplus.com, Password: Test@1234
* **Patient:** Email: alice@patient.com, Password: Test@1234
*(Note: If your specific task requires Super Admin access, I will send those credentials to you directly via DM).*

**3. Git & Branching Guidelines**
* **Always pull from \`main\`** before creating your branch.
* **Branch Naming:** Because our tracker uses text IDs instead of numbers, please name your branches using this format: \`feat/[your-name]-[short-issue-description]\` *(Example: \`feat/daniel-login-fixes\`)*.
* **Pull Requests (PRs):** You **must** create a PR for your changes to be merged.
  * For **Backend PRs**: Assign me as the only reviewer.
  * For **Frontend PRs**: Assign me and Daniel as reviewers.

**Happy Coding!**`;

async function main() {
  const adminEmail = 't.niyonkuru@ubwengelab.rw';
  const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  
  if (!admin) {
    console.error(`Admin ${adminEmail} not found. Ensure the seed was run and that user exists.`);
    return;
  }

  // Find all issues with assignees
  const assignedIssues = await prisma.issue.findMany({
    where: { assigneeId: { not: null } },
  });

  console.log(`Found ${assignedIssues.length} assigned issues.`);

  let notifiedCount = 0;

  for (const issue of assignedIssues) {
    // 1. Create the comment
    await prisma.comment.create({
      data: {
        issueId: issue.id,
        authorId: admin.id,
        body: MESSAGE_BODY
      }
    });

    // 2. Notify assignee and reporter if they are not the author
    const recipients = new Set<string>();
    if (issue.assigneeId && issue.assigneeId !== admin.id) recipients.add(issue.assigneeId);
    if (issue.reporterId && issue.reporterId !== admin.id) recipients.add(issue.reporterId);

    if (recipients.size > 0) {
      await prisma.notification.createMany({
        data: Array.from(recipients).map(userId => ({
          userId,
          type: NotificationType.COMMENT_ADDED,
          title: `New comment from ${admin.fullName}`,
          message: 'Development guidelines and testing credentials for your assignment.',
          issueId: issue.id,
          projectId: issue.projectId
        }))
      });
      notifiedCount += recipients.size;
    }
  }

  console.log(`✅ Broadcast complete. Created ${assignedIssues.length} comments and sent ${notifiedCount} notifications.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
