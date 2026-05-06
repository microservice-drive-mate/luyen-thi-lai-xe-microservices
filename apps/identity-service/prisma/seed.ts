import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.identityUser.upsert({
    where: { email: 'seed-admin@local.dev' },
    update: { name: 'Seed Admin' },
    create: {
      email: 'seed-admin@local.dev',
      name: 'Seed Admin',
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
