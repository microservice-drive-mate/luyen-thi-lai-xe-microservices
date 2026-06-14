import { BadRequestException } from '@nestjs/common';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validateCourseSchedule(input: {
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
  effectiveFrom?: Date;
  effectiveTo?: Date | null;
}): void {
  if (
    input.dayOfWeek !== undefined &&
    (!Number.isInteger(input.dayOfWeek) ||
      input.dayOfWeek < 1 ||
      input.dayOfWeek > 7)
  ) {
    throw new BadRequestException('dayOfWeek must be an integer from 1 to 7');
  }

  if (input.startTime !== undefined && !TIME_RE.test(input.startTime)) {
    throw new BadRequestException('startTime must match HH:mm');
  }
  if (input.endTime !== undefined && !TIME_RE.test(input.endTime)) {
    throw new BadRequestException('endTime must match HH:mm');
  }
  if (
    input.startTime !== undefined &&
    input.endTime !== undefined &&
    input.startTime >= input.endTime
  ) {
    throw new BadRequestException('startTime must be before endTime');
  }
  if (
    input.effectiveFrom &&
    input.effectiveTo &&
    input.effectiveFrom > input.effectiveTo
  ) {
    throw new BadRequestException('effectiveFrom must be before effectiveTo');
  }
}

export function toDateOnly(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException('date must match YYYY-MM-DD');
  }
  return date;
}
