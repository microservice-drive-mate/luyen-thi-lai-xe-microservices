import { CourseMaterialLinkedEvent } from '../../events/course-material-linked.event';
import { CourseCreatedEvent } from '../../events/course-created.event';
import { Course } from './course.aggregate';
import { CourseStatus, LicenseCategory } from './course.types';

function createCourse(): Course {
  return Course.create({
    id: 'course-1',
    title: 'B2 fundamentals',
    licenseCategory: LicenseCategory.B2,
    createdById: 'admin-1',
    instructors: [{ id: 'course-instructor-1', instructorId: 'instructor-1' }],
  });
}

describe('Course', () => {
  it('creates with application-provided ids and starts as draft', () => {
    const course = createCourse();

    expect(course.id).toBe('course-1');
    expect(course.status).toBe(CourseStatus.DRAFT);
    expect(course.instructorIds).toEqual(['instructor-1']);
    expect(course.version).toBe(1);
    expect(course.getDomainEvents()).toEqual([expect.any(CourseCreatedEvent)]);
  });

  it('adds lessons and can activate once lessons exist', () => {
    const course = createCourse();

    course.addLesson({
      id: 'lesson-1',
      title: 'Traffic signs',
      order: 1,
    });
    course.activate();

    expect(course.totalLessons).toBe(1);
    expect(course.status).toBe(CourseStatus.ACTIVE);
  });

  it('emits an event when linking media-backed material', () => {
    const course = createCourse();
    course.clearDomainEvents();

    course.addMaterial({
      id: 'material-1',
      title: 'Road signs PDF',
      mediaFileId: 'media-1',
    });

    expect(course.materials).toHaveLength(1);
    expect(course.getDomainEvents()).toEqual([
      expect.any(CourseMaterialLinkedEvent),
    ]);
  });
});
