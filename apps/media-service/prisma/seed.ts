import { PrismaPg } from '@prisma/adapter-pg';
import { FileStatus, PrismaClient } from '@prisma/media-client';
import { DEMO_IDS, DEMO_USERS } from '../../../scripts/demo-seed-data';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required to seed media data');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const demoFiles = [
  {
    id: DEMO_IDS.mediaFile('b2-handbook'),
    storageKey: 'demo/course-materials/b2-handbook.pdf',
    originalName: 'cam-nang-on-thi-b2.pdf',
    mimeType: 'application/pdf',
    fileSize: 1_572_864,
    bucketName: 'media',
    uploadedById: DEMO_USERS.admin.id,
    isPublic: true,
    status: FileStatus.LINKED,
  },
  {
    id: DEMO_IDS.mediaFile('student-avatar-placeholder'),
    storageKey: 'demo/avatars/student-b1-placeholder.png',
    originalName: 'student-b1-placeholder.png',
    mimeType: 'image/png',
    fileSize: 245_760,
    bucketName: 'media',
    uploadedById: DEMO_USERS.students[1].id,
    isPublic: false,
    status: FileStatus.UNLINKED,
  },
] as const;

async function main() {
  for (const file of demoFiles) {
    await prisma.fileObject.upsert({
      where: { id: file.id },
      update: {
        storageKey: file.storageKey,
        originalName: file.originalName,
        mimeType: file.mimeType,
        fileSize: file.fileSize,
        bucketName: file.bucketName,
        uploadedById: file.uploadedById,
        isPublic: file.isPublic,
        status: file.status,
      },
      create: {
        id: file.id,
        storageKey: file.storageKey,
        originalName: file.originalName,
        mimeType: file.mimeType,
        fileSize: file.fileSize,
        bucketName: file.bucketName,
        uploadedById: file.uploadedById,
        isPublic: file.isPublic,
        status: file.status,
      },
    });
  }

  console.log(`Seeded media_db: ${demoFiles.length} file objects`);
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
