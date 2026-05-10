const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const users = await prisma.user.findFirst();
    console.log('Successfully connected and queried user:', users?.id || 'none');
  } catch (error) {
    console.error('Prisma Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
