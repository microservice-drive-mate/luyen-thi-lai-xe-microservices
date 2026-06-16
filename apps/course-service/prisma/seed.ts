import { PrismaPg } from '@prisma/adapter-pg';
import {
  CourseStatus,
  EnrollmentStatus,
  LicenseCategory,
  PrismaClient,
} from '@prisma/course-client';
import {
  DEMO_COURSE_ENROLLMENTS,
  DEMO_COURSE_SCHEDULES,
  DEMO_COURSES,
  DEMO_IDS,
  DEMO_USERS,
  demoInstructorIdsForCourse,
} from '../../../scripts/demo-seed-data';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required to seed course data');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const lessons = [
  'Tổng quan luật giao thông',
  'Biển báo và vạch kẻ đường',
  'Kỹ thuật điều khiển xe',
  'Xử lý tình huống nguy hiểm',
  'Ôn tập và bài kiểm tra',
];

const legacyCourseId = 'seed-course-b2-0001';
const legacyLessonId = 'seed-lesson-b2-0001';
const legacyAdminId = 'seed-user-admin-0001';

async function seedCourse(course: (typeof DEMO_COURSES)[number]) {
  const courseId = DEMO_IDS.course(course.slug);

  await prisma.course.upsert({
    where: { id: courseId },
    update: {
      title: course.title,
      description: `${course.title} dành cho demo frontend và ASR.`,
      licenseCategory: course.licenseCategory as LicenseCategory,
      totalLessons: lessons.length,
      duration: '8 tuần',
      tuitionFee: course.licenseCategory === 'A1' ? '2500000' : '6500000',
      capacity: 30,
      status: course.status as CourseStatus,
      createdById: DEMO_USERS.admin.id,
    },
    create: {
      id: courseId,
      title: course.title,
      description: `${course.title} dành cho demo frontend và ASR.`,
      licenseCategory: course.licenseCategory as LicenseCategory,
      totalLessons: lessons.length,
      duration: '8 tuần',
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
      prerequisites: 'Có giấy tờ tùy thân hợp lệ',
      attendanceRate: 80,
      minPassScore: 80,
      requiredExams: 2,
    },
    create: {
      id: DEMO_IDS.requirement(course.slug),
      courseId,
      minAge: course.licenseCategory === 'A1' ? 16 : 18,
      prerequisites: 'Có giấy tờ tùy thân hợp lệ',
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
        content: `Nội dung bài ${index + 1} của ${course.title}.`,
        order: index + 1,
      },
      create: {
        id: DEMO_IDS.lesson(course.slug, index + 1),
        courseId,
        title,
        content: `Nội dung bài ${index + 1} của ${course.title}.`,
        order: index + 1,
      },
    });
  }

  for (const order of [1, 2]) {
    await prisma.courseMaterial.upsert({
      where: { id: DEMO_IDS.material(course.slug, order) },
      update: {
        title: order === 1 ? 'Tài liệu lý thuyết' : 'Checklist thực hành',
        fileUrl: `https://example.com/demo/${course.slug}/material-${order}.pdf`,
        type: 'PDF',
      },
      create: {
        id: DEMO_IDS.material(course.slug, order),
        courseId,
        title: order === 1 ? 'Tài liệu lý thuyết' : 'Checklist thực hành',
        fileUrl: `https://example.com/demo/${course.slug}/material-${order}.pdf`,
        type: 'PDF',
      },
    });
  }

  for (const instructorId of demoInstructorIdsForCourse(course.slug)) {
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

async function seedCourseSchedules() {
  for (const [index, schedule] of DEMO_COURSE_SCHEDULES.entries()) {
    const instructorId = demoInstructorIdsForCourse(schedule.courseSlug)[0];
    await prisma.courseSchedule.upsert({
      where: { id: DEMO_IDS.schedule(schedule.courseSlug, index + 1) },
      update: {
        instructorId,
        dayOfWeek: schedule.dayOfWeek,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        room: schedule.room,
        effectiveFrom: new Date('2026-06-01T00:00:00.000Z'),
        effectiveTo: null,
        isActive: true,
      },
      create: {
        id: DEMO_IDS.schedule(schedule.courseSlug, index + 1),
        courseId: DEMO_IDS.course(schedule.courseSlug),
        instructorId,
        dayOfWeek: schedule.dayOfWeek,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        room: schedule.room,
        effectiveFrom: new Date('2026-06-01T00:00:00.000Z'),
        effectiveTo: null,
        isActive: true,
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

  await seedCourseSchedules();

  for (const enrollment of DEMO_COURSE_ENROLLMENTS) {
    const student = DEMO_USERS.students[enrollment.studentIndex];
    const status = enrollment.status as EnrollmentStatus;
    await prisma.courseEnrollment.upsert({
      where: {
        courseId_studentId: {
          courseId: DEMO_IDS.course(enrollment.courseSlug),
          studentId: student.id,
        },
      },
      update: {
        status,
        progress: enrollment.progress,
        completedAt:
          status === EnrollmentStatus.COMPLETED
            ? new Date('2026-05-18T09:00:00.000Z')
            : null,
      },
      create: {
        id: DEMO_IDS.enrollment(enrollment.courseSlug, student.id),
        courseId: DEMO_IDS.course(enrollment.courseSlug),
        studentId: student.id,
        status,
        progress: enrollment.progress,
        enrolledAt: new Date('2026-05-01T09:00:00.000Z'),
        completedAt:
          status === EnrollmentStatus.COMPLETED
            ? new Date('2026-05-18T09:00:00.000Z')
            : null,
      },
    });
  }

  await prisma.course.upsert({
    where: { id: legacyCourseId },
    update: {
      title: 'Khởi động khóa B2',
      status: CourseStatus.ACTIVE,
      totalLessons: 1,
    },
    create: {
      id: legacyCourseId,
      title: 'Khởi động khóa B2',
      description: 'Dữ liệu seed local cho course-service',
      licenseCategory: LicenseCategory.B2,
      totalLessons: 1,
      duration: '30 ngày',
      tuitionFee: '1500000',
      capacity: 30,
      status: CourseStatus.ACTIVE,
      createdById: legacyAdminId,
    },
  });

  await prisma.lesson.upsert({
    where: { id: legacyLessonId },
    update: {
      title: 'Buổi học đầu tiên',
      order: 1,
    },
    create: {
      id: legacyLessonId,
      courseId: legacyCourseId,
      title: 'Buổi học đầu tiên',
      content: 'Giới thiệu tổng quan khóa học và lộ trình học',
      order: 1,
    },
  });

  console.log(
    `Seeded course_db: ${DEMO_COURSES.length} courses, ${DEMO_COURSE_SCHEDULES.length} schedules, ${DEMO_USERS.students.length} student license profiles`,
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
