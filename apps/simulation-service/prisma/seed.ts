import { PrismaPg } from '@prisma/adapter-pg';
import {
  LicenseCategory,
  PrismaClient,
  SimulationSessionStatus,
} from '@prisma/simulation-client';
import { DEMO_IDS, DEMO_USERS } from '../../../scripts/demo-seed-data';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required to seed simulation data');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const maneuvers = [
  {
    slug: 'start',
    title: 'Xuất phát',
    description:
      'Thực hành quy trình xuất phát đúng kỹ thuật trong bài sa hình.',
    checkpoints: [
      [
        'Chuẩn bị trước vạch',
        'Dừng xe đúng vị trí, thắt dây an toàn và kiểm tra gương.',
        'Trừ điểm nếu không thắt dây an toàn.',
      ],
      [
        'Bật tín hiệu',
        'Bật đèn xi nhan trái trước khi khởi hành.',
        'Trừ điểm nếu bật tín hiệu sai thời điểm.',
      ],
      [
        'Khởi hành êm',
        'Nhả côn và tăng ga ổn định, không để xe chết máy.',
        'Trừ điểm nếu chết máy hoặc rung giật mạnh.',
      ],
    ],
  },
  {
    slug: 'pedestrian-stop',
    title: 'Dừng xe nhường đường người đi bộ',
    description: 'Dừng xe đúng vạch và khởi hành lại an toàn.',
    checkpoints: [
      [
        'Giảm tốc sớm',
        'Giảm tốc trước vạch dừng, giữ khoảng cách an toàn.',
        'Trừ điểm nếu phanh gấp.',
      ],
      [
        'Dừng đúng vị trí',
        'Bánh trước không đè lên vạch người đi bộ.',
        'Trừ điểm nếu đè xe quá vạch.',
      ],
      [
        'Khởi hành lại',
        'Quan sát hai bên trước khi đi tiếp.',
        'Trừ điểm nếu không quan sát.',
      ],
    ],
  },
  {
    slug: 'hill-start',
    title: 'Dừng và khởi hành ngang dốc',
    description: 'Kiểm soát phanh, côn và ga khi khởi hành trên dốc.',
    checkpoints: [
      [
        'Dừng trên dốc',
        'Dừng xe trong vùng quy định và giữ xe ổn định.',
        'Trừ điểm nếu xe trôi.',
      ],
      [
        'Phối hợp phanh côn ga',
        'Nhả phanh đúng lúc, tăng ga vừa đủ.',
        'Loại nếu trôi quá giới hạn.',
      ],
      [
        'Ra khỏi dốc',
        'Tăng tốc nhẹ và giữ hướng xe thẳng.',
        'Trừ điểm nếu chết máy.',
      ],
    ],
  },
  {
    slug: 'narrow-track',
    title: 'Qua vệt bánh xe và đường hẹp vuông góc',
    description: 'Canh chỉnh bánh xe đúng vệt và điều khiển qua đường hẹp.',
    checkpoints: [
      [
        'Canh vệt bánh',
        'Canh gương và mũi xe trước khi vào vệt bánh.',
        'Trừ điểm nếu lệch vệt.',
      ],
      [
        'Giữ tốc độ chậm',
        'Đi đều ga, không đánh lái đột ngột.',
        'Trừ điểm nếu chạm vạch.',
      ],
      [
        'Ra khỏi bài',
        'Trả lái thẳng và quan sát hướng tiếp theo.',
        'Trừ điểm nếu mất hướng xe.',
      ],
    ],
  },
  {
    slug: 'traffic-light',
    title: 'Qua ngã tư có tín hiệu',
    description: 'Chấp hành đèn tín hiệu và giữ làn đường.',
    checkpoints: [
      [
        'Quan sát đèn',
        'Nhận diện tín hiệu từ xa và chuẩn bị tốc độ phù hợp.',
        'Trừ điểm nếu vượt đèn đỏ.',
      ],
      ['Giữ làn', 'Đi đúng làn khi qua ngã tư.', 'Trừ điểm nếu lấn vạch.'],
      [
        'Thoát ngã tư',
        'Tăng tốc sau khi qua vùng giao cắt.',
        'Trừ điểm nếu dừng sai vị trí.',
      ],
    ],
  },
  {
    slug: 'parallel-park',
    title: 'Ghép xe dọc',
    description: 'Thực hiện ghép xe vào nơi đỗ dọc đúng kích thước.',
    checkpoints: [
      [
        'Chọn mốc căn',
        'Dừng xe song song và căn mốc bắt đầu.',
        'Trừ điểm nếu quá mốc.',
      ],
      [
        'Lùi vào chuồng',
        'Đánh lái và lùi chậm theo đúng quỹ đạo.',
        'Trừ điểm nếu chạm vạch.',
      ],
      [
        'Chỉnh xe',
        'Trả lái và căn xe nằm trong chuồng.',
        'Loại nếu để xe ngoài khu vực.',
      ],
    ],
  },
];

const errors = [
  ['SA-HINH-001', 'Không thắt dây an toàn trước khi xuất phát.', 'MAJOR'],
  ['SA-HINH-002', 'Để xe chết máy trong bài thi.', 'MAJOR'],
  ['SA-HINH-003', 'Vượt quá vạch dừng quy định.', 'CRITICAL'],
  ['SA-HINH-004', 'Không bật tín hiệu khi cần chuyển hướng.', 'MINOR'],
  ['SA-HINH-005', 'Chạm vạch hoặc lệch vệt bánh xe.', 'MAJOR'],
  ['SA-HINH-006', 'Không quan sát trước khi khởi hành lại.', 'MINOR'],
];

async function seedManeuverForCategory(
  maneuver: (typeof maneuvers)[number],
  licenseCategory: LicenseCategory,
  displayOrder: number,
) {
  const slug = `${licenseCategory.toLowerCase()}-${maneuver.slug}`;
  const id = DEMO_IDS.maneuver(slug);

  await prisma.maneuver.upsert({
    where: { id },
    update: {
      title: maneuver.title,
      description: maneuver.description,
      licenseCategory,
      displayOrder,
      isActive: true,
    },
    create: {
      id,
      title: maneuver.title,
      description: maneuver.description,
      licenseCategory,
      displayOrder,
    },
  });

  for (const [index, checkpoint] of maneuver.checkpoints.entries()) {
    await prisma.maneuverCheckpoint.upsert({
      where: { id: DEMO_IDS.checkpoint(slug, index + 1) },
      update: {
        title: checkpoint[0],
        instruction: checkpoint[1],
        penalty: checkpoint[2],
        displayOrder: index + 1,
      },
      create: {
        id: DEMO_IDS.checkpoint(slug, index + 1),
        maneuverId: id,
        title: checkpoint[0],
        instruction: checkpoint[1],
        penalty: checkpoint[2],
        displayOrder: index + 1,
      },
    });
  }
}

async function main() {
  for (const category of [LicenseCategory.B1, LicenseCategory.B2]) {
    for (const [index, maneuver] of maneuvers.entries()) {
      await seedManeuverForCategory(maneuver, category, index + 1);
    }

    for (const [code, description, severity] of errors) {
      const errorCode = `${category}-${code}`;
      await prisma.maneuverError.upsert({
        where: { id: DEMO_IDS.maneuverError(category, errorCode) },
        update: {
          licenseCategory: category,
          code: errorCode,
          description,
          severity,
        },
        create: {
          id: DEMO_IDS.maneuverError(category, errorCode),
          licenseCategory: category,
          code: errorCode,
          description,
          severity,
        },
      });
    }
  }

  const student = DEMO_USERS.students.find((item) => item.licenseTier === 'B1');
  if (student) {
    const sessionId = DEMO_IDS.simulationSession(student.id, 'completed-b1');
    await prisma.simulationSession.upsert({
      where: { id: sessionId },
      update: {
        status: SimulationSessionStatus.COMPLETED,
        totalScenarios: 3,
        correctCount: 3,
        score: 100,
        isPassed: true,
        completedAt: new Date('2026-05-21T09:00:00.000Z'),
      },
      create: {
        id: sessionId,
        studentId: student.id,
        licenseCategory: LicenseCategory.B1,
        status: SimulationSessionStatus.COMPLETED,
        totalScenarios: 3,
        correctCount: 3,
        score: 100,
        isPassed: true,
        startedAt: new Date('2026-05-21T08:45:00.000Z'),
        completedAt: new Date('2026-05-21T09:00:00.000Z'),
      },
    });

    for (let index = 1; index <= 3; index += 1) {
      const scenarioId = DEMO_IDS.checkpoint('b1-start', index);
      await prisma.simulationAnswer.upsert({
        where: { sessionId_scenarioId: { sessionId, scenarioId } },
        update: {
          selectedOptionId: `demo-option-${index}`,
          isCorrect: true,
          answeredAt: new Date('2026-05-21T08:50:00.000Z'),
        },
        create: {
          id: DEMO_IDS.simulationAnswer(sessionId, scenarioId),
          sessionId,
          scenarioId,
          selectedOptionId: `demo-option-${index}`,
          isCorrect: true,
          answeredAt: new Date('2026-05-21T08:50:00.000Z'),
        },
      });
    }
  }

  console.log(
    `Seeded simulation_db: ${maneuvers.length * 2} maneuvers, ${errors.length * 2} errors`,
  );
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
