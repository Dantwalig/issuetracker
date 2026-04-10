import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PLAIN_TEXT_MESSAGE = `Hello! Here are the development guidelines and testing credentials for your assignment in this sprint.

1. Local Setup & Running the App
Please ensure you pull the latest changes from 'main' before doing anything. 
- Install: Run 'npm install' in both the frontend and backend directories.
- Build: Run 'npm run build' in both directories to ensure there are no compilation errors.
- Start Backend: 'npm run start:dev'
- Start Frontend: 'npm run dev' (Note: If you run 'npm run start' on the frontend, you must make sure the build was successful first, but 'npm run dev' is best for active coding).

2. Test Credentials
Use the following credentials to test your implementations based on the role you are interacting with:
- Pharmacy Owner: Email: owner@medplus.com, Password: Test@1234
- Branch Manager: Email: manager@medplus.com, Password: Test@1234
- Staff Pharmacist: Email: pharmacist@medplus.com, Password: Test@1234
- Cashier: Email: cashier@medplus.com, Password: Test@1234
- Patient: Email: alice@patient.com, Password: Test@1234
(Note: If your specific task requires Super Admin access, I will send those credentials to you directly via DM).

3. Git & Branching Guidelines
- Always pull from 'main' before creating your branch.
- Branch Naming: Because our tracker uses text IDs instead of numbers, please name your branches using this format: feat/[your-name]-[short-issue-description] (Example: feat/daniel-login-fixes).
- Pull Requests (PRs): You must create a PR for your changes to be merged.
  - For Backend PRs: Assign me as the only reviewer.
  - For Frontend PRs: Assign me and Daniel as reviewers.

Happy Coding!`;

async function main() {
  const adminEmail = 't.niyonkuru@ubwengelab.rw';
  const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  
  if (!admin) return;

  // We are using an updateMany query so that it updates the text WITHOUT firing any new notifications.
  const result = await prisma.comment.updateMany({
    where: { 
      authorId: admin.id,
      body: {
        contains: '**Hello! Here are the development guidelines and testing credentials'
      }
    },
    data: {
      body: PLAIN_TEXT_MESSAGE
    }
  });

  console.log(`✅ Perfectly replaced ${result.count} comments with the plain text version!`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
