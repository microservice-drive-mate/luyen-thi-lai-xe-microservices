import { BadRequestException } from '@nestjs/common';
import {
  toDateOnly,
  validateCourseSchedule,
} from './course-schedule.validation';

describe('course schedule validation', () => {
  it('accepts a valid weekly schedule', () => {
    expect(() =>
      validateCourseSchedule({
        dayOfWeek: 1,
        startTime: '07:00',
        endTime: '09:00',
        effectiveFrom: toDateOnly('2026-06-01'),
        effectiveTo: toDateOnly('2026-06-30'),
      }),
    ).not.toThrow();
  });

  it('rejects invalid day of week', () => {
    expect(() => validateCourseSchedule({ dayOfWeek: 8 })).toThrow(
      BadRequestException,
    );
  });

  it('rejects invalid time range', () => {
    expect(() =>
      validateCourseSchedule({ startTime: '09:00', endTime: '07:00' }),
    ).toThrow(BadRequestException);
  });

  it('rejects invalid date strings', () => {
    expect(() => toDateOnly('2026/06/01')).toThrow(BadRequestException);
  });
});
