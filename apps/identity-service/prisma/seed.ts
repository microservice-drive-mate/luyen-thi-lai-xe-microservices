import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// UUID phải khớp với field "id" của user admin_test trong realm-export.json
const ADMIN_KEYCLOAK_ID = '10000000-0000-0000-0000-000000000001';

async function main() {
  await prisma.identityUser.upsert({
    where: { id: ADMIN_KEYCLOAK_ID },
    update: {},
    create: {
      id: ADMIN_KEYCLOAK_ID,
      email: 'admin@test.com',
      name: 'Admin Test',
    },
  });

  console.log('✓ Seeded identity_db: admin@test.com');
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
