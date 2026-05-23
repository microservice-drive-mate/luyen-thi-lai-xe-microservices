import { PrismaPg } from '@prisma/adapter-pg';
import {
  CourseStatus,
  EnrollmentStatus,
  LicenseCategory,
  PrismaClient,
} from '@prisma/course-client';
import {
  DEMO_COURSES,
  DEMO_IDS,
  DEMO_USERS,
} from '../../../scripts/demo-seed-data';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required to seed course data');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const lessons = [
  'Tong quan luat giao thong',
  'Bien bao va vach ke duong',
  'Ky thuat dieu khien xe',
  'Xu ly tinh huong nguy hiem',
  'On tap va bai kiem tra',
];

const enrollments = [
  {
    courseSlug: 'a1-basic',
    studentIndex: 0,
    progress: 45,
    status: EnrollmentStatus.ACTIVE,
  },
  {
    courseSlug: 'b1-basic',
    studentIndex: 1,
    progress: 75,
    status: EnrollmentStatus.ACTIVE,
  },
  {
    courseSlug: 'b1-intensive',
    studentIndex: 2,
    progress: 25,
    status: EnrollmentStatus.ACTIVE,
  },
  {
    courseSlug: 'b2-basic',
    studentIndex: 3,
    progress: 100,
    status: EnrollmentStatus.COMPLETED,
  },
  {
    courseSlug: 'b2-advanced',
    studentIndex: 4,
    progress: 10,
    status: EnrollmentStatus.ACTIVE,
  },
];

function instructorIdsForCourse(courseSlug: string): string[] {
  if (courseSlug.startsWith('b2')) return [DEMO_USERS.instructors[1].id];
  return [DEMO_USERS.instructors[0].id];
}

const legacyCourseId = 'seed-course-b2-0001';
const legacyLessonId = 'seed-lesson-b2-0001';
const legacyAdminId = 'seed-user-admin-0001';

async function seedCourse(course: (typeof DEMO_COURSES)[number]) {
  const courseId = DEMO_IDS.course(course.slug);

  await prisma.course.upsert({
    where: { id: courseId },
    update: {
      title: course.title,
      description: `${course.title} danh cho demo frontend va ASR.`,
      licenseCategory: course.licenseCategory as LicenseCategory,
      totalLessons: lessons.length,
      duration: '8 tuan',
      tuitionFee: course.licenseCategory === 'A1' ? '2500000' : '6500000',
      capacity: 30,
      status: course.status as CourseStatus,
      createdById: DEMO_USERS.admin.id,
    },
    create: {
      id: courseId,
      title: course.title,
      description: `${course.title} danh cho demo frontend va ASR.`,
      licenseCategory: course.licenseCategory as LicenseCategory,
      totalLessons: lessons.length,
      duration: '8 tuan',
      tuitionFee: course.licenseCategory === 'A1' ? '2500000' : '6500000',
      capacity: 30,
      status: course.status as CourseStatus,
      createdById: DEMO_USERS.admin.id,
    },
  });

  await prisma.courseRequirement.upsert({
    where: { courseId },
    update: {
      minAge: course.licenseCategory === 'A1' ? 16 : 18,
      prerequisites: 'Co giay to tuy than hop le',
      attendanceRate: 80,
      minPassScore: 80,
      requiredExams: 2,
    },
    create: {
      id: DEMO_IDS.requirement(course.slug),
      courseId,
      minAge: course.licenseCategory === 'A1' ? 16 : 18,
      prerequisites: 'Co giay to tuy than hop le',
      attendanceRate: 80,
      minPassScore: 80,
      requiredExams: 2,
    },
  });

  for (const [index, title] of lessons.entries()) {
    await prisma.lesson.upsert({
      where: { id: DEMO_IDS.lesson(course.slug, index + 1) },
      update: {
        title,
        content: `Noi dung bai ${index + 1} cua ${course.title}.`,
        order: index + 1,
      },
      create: {
        id: DEMO_IDS.lesson(course.slug, index + 1),
        courseId,
        title,
        content: `Noi dung bai ${index + 1} cua ${course.title}.`,
        order: index + 1,
      },
    });
  }

  for (const order of [1, 2]) {
    await prisma.courseMaterial.upsert({
      where: { id: DEMO_IDS.material(course.slug, order) },
      update: {
        title: order === 1 ? 'Tai lieu ly thuyet' : 'Checklist thuc hanh',
        fileUrl: `https://example.com/demo/${course.slug}/material-${order}.pdf`,
        type: 'PDF',
      },
      create: {
        id: DEMO_IDS.material(course.slug, order),
        courseId,
        title: order === 1 ? 'Tai lieu ly thuyet' : 'Checklist thuc hanh',
        fileUrl: `https://example.com/demo/${course.slug}/material-${order}.pdf`,
        type: 'PDF',
      },
    });
  }

  for (const instructorId of instructorIdsForCourse(course.slug)) {
    await prisma.courseInstructor.upsert({
      where: {
        courseId_instructorId: {
          courseId,
          instructorId,
        },
      },
      update: {},
      create: {
        id: DEMO_IDS.instructor(course.slug, instructorId),
        courseId,
        instructorId,
      },
    });
  }
}

async function main() {
  for (const student of DEMO_USERS.students) {
    await prisma.studentLicenseProfile.upsert({
      where: { studentId: student.id },
      update: { licenseTier: student.licenseTier as LicenseCategory },
      create: {
        studentId: student.id,
        licenseTier: student.licenseTier as LicenseCategory,
      },
    });
  }

  for (const course of DEMO_COURSES) {
    await seedCourse(course);
  }

  for (const enrollment of enrollments) {
    const student = DEMO_USERS.students[enrollment.studentIndex];
    await prisma.courseEnrollment.upsert({
      where: {
        courseId_studentId: {
          courseId: DEMO_IDS.course(enrollment.courseSlug),
          studentId: student.id,
        },
      },
      update: {
        status: enrollment.status,
        progress: enrollment.progress,
        completedAt:
          enrollment.status === EnrollmentStatus.COMPLETED
            ? new Date('2026-05-18T09:00:00.000Z')
            : null,
      },
      create: {
        id: DEMO_IDS.enrollment(enrollment.courseSlug, student.id),
        courseId: DEMO_IDS.course(enrollment.courseSlug),
        studentId: student.id,
        status: enrollment.status,
        progress: enrollment.progress,
        enrolledAt: new Date('2026-05-01T09:00:00.000Z'),
        completedAt:
          enrollment.status === EnrollmentStatus.COMPLETED
            ? new Date('2026-05-18T09:00:00.000Z')
            : null,
      },
    });
  }

  await prisma.course.upsert({
    where: { id: legacyCourseId },
    update: {
      title: 'Khoi dong khoa B2',
      status: CourseStatus.ACTIVE,
      totalLessons: 1,
    },
    create: {
      id: legacyCourseId,
      title: 'Khoi dong khoa B2',
      description: 'Du lieu seed local cho course-service',
      licenseCategory: LicenseCategory.B2,
      totalLessons: 1,
      duration: '30 ngay',
      tuitionFee: '1500000',
      capacity: 30,
      status: CourseStatus.ACTIVE,
      createdById: legacyAdminId,
    },
  });

  await prisma.lesson.upsert({
    where: { id: legacyLessonId },
    update: {
      title: 'Buoi hoc dau tien',
      order: 1,
    },
    create: {
      id: legacyLessonId,
      courseId: legacyCourseId,
      title: 'Buoi hoc dau tien',
      content: 'Gioi thieu tong quan khoa hoc va lo trinh hoc',
      order: 1,
    },
  });

  console.log(
    `Seeded course_db: ${DEMO_COURSES.length} courses, ${DEMO_USERS.students.length} student license profiles`,
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
