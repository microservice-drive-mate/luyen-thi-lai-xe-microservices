import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { CourseNotFoundException } from '../../../domain/exceptions/course-not-found.exception';
import { LessonNotFoundException } from '../../../domain/exceptions/lesson-not-found.exception';
import { CourseRepository } from '../../../domain/repositories/course.repository';
import { LessonResult } from '../shared/course.result';
import { GetLessonQuery } from './get-lesson.query';

@Injectable()
export class GetLessonUseCase
  implements IUseCase<GetLessonQuery, LessonResult>
{
  constructor(private readonly courseRepository: CourseRepository) {}

  async execute(query: GetLessonQuery): Promise<LessonResult> {
    const course = await this.courseRepository.findById(query.courseId);
    if (!course) throw new CourseNotFoundException(query.courseId);

    const lesson = course.lessons.find((l) => l.id === query.lessonId);
    if (!lesson) throw new LessonNotFoundException(query.lessonId);

    return {
      id: lesson.id,
      courseId: lesson.courseId,
      title: lesson.title,
      content: lesson.content,
      order: lesson.order,
      createdAt: lesson.createdAt,
    };
  }
}
