import { PrismaPg } from '@prisma/adapter-pg';
import { LicenseCategory, PrismaClient } from '@prisma/exam-client';
import {
  DEMO_IDS,
  DEMO_TOPIC_IDS,
  DEMO_USERS,
} from '../../../scripts/demo-seed-data';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required to seed exam data');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const templates = [
  {
    slug: 'a1-basic',
    name: 'Đề thi A1 cơ bản',
    description: 'Đề thi mô phỏng theo cấu trúc GPLX hạng A1',
    licenseCategory: LicenseCategory.A1,
    totalQuestions: 25,
    passingScore: 21,
    durationMinutes: 19,
    criticalQuestions: 1,
    maxCriticalMistakes: 0,
    distribution: [5, 3, 4, 3, 5, 5],
  },
  {
    slug: 'b1-basic',
    name: 'Đề thi B1 cơ bản',
    description: 'Đề thi mô phỏng theo cấu trúc GPLX hạng B1',
    licenseCategory: LicenseCategory.B1,
    totalQuestions: 30,
    passingScore: 26,
    durationMinutes: 20,
    criticalQuestions: 1,
    maxCriticalMistakes: 0,
    distribution: [5, 4, 5, 4, 6, 6],
  },
  {
    slug: 'b2-basic',
    name: 'Đề thi B2 cơ bản',
    description: 'Đề thi mô phỏng theo cấu trúc GPLX hạng B2',
    licenseCategory: LicenseCategory.B2,
    totalQuestions: 35,
    passingScore: 32,
    durationMinutes: 22,
    criticalQuestions: 1,
    maxCriticalMistakes: 0,
    distribution: [6, 4, 6, 5, 7, 7],
  },
  {
    slug: 'b2-advanced',
    name: 'Đề thi B2 nâng cao',
    description: 'Đề thi luyện tập nâng cao cho học viên B2',
    licenseCategory: LicenseCategory.B2,
    totalQuestions: 35,
    passingScore: 32,
    durationMinutes: 22,
    criticalQuestions: 2,
    maxCriticalMistakes: 0,
    distribution: [6, 4, 6, 5, 7, 7],
  },
];

function topicDistribution(counts: number[]) {
  return DEMO_TOPIC_IDS.map((topicId, index) => ({
    topicId,
    questionCount: counts[index],
  }));
}

async function main() {
  for (const template of templates) {
    await prisma.examTemplate.upsert({
      where: { id: DEMO_IDS.examTemplate(template.slug) },
      update: {
        name: template.name,
        description: template.description,
        licenseCategory: template.licenseCategory,
        totalQuestions: template.totalQuestions,
        passingScore: template.passingScore,
        durationMinutes: template.durationMinutes,
        criticalQuestions: template.criticalQuestions,
        maxCriticalMistakes: template.maxCriticalMistakes,
        shuffleQuestions: true,
        topicDistribution: topicDistribution(template.distribution),
        isActive: true,
        isDeleted: false,
      },
      create: {
        id: DEMO_IDS.examTemplate(template.slug),
        name: template.name,
        description: template.description,
        licenseCategory: template.licenseCategory,
        totalQuestions: template.totalQuestions,
        passingScore: template.passingScore,
        durationMinutes: template.durationMinutes,
        criticalQuestions: template.criticalQuestions,
        maxCriticalMistakes: template.maxCriticalMistakes,
        shuffleQuestions: true,
        topicDistribution: topicDistribution(template.distribution),
        createdById: DEMO_USERS.admin.id,
      },
    });
  }

  console.log(`Seeded exam_db: ${templates.length} exam templates`);
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
