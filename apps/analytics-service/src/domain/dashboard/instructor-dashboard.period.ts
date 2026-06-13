import { BadRequestException } from '@nestjs/common';
import { InstructorDashboardQueryPeriod } from './instructor-dashboard.types';

const TIMEZONE = 'Asia/Ho_Chi_Minh';

export function createInstructorDashboardPeriod(input: {
  month?: string;
  weekStart?: string;
  date?: string;
  now?: Date;
}): InstructorDashboardQueryPeriod {
  const now = input.now ?? new Date();
  const month = input.month ?? now.toISOString().slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new BadRequestException('month must match YYYY-MM');
  }
  const monthFrom = new Date(`${month}-01T00:00:00.000Z`);
  const monthTo = new Date(
    Date.UTC(monthFrom.getUTCFullYear(), monthFrom.getUTCMonth() + 1, 1),
  );

  const date = parseDate(input.date ?? now.toISOString().slice(0, 10), 'date');
  const weekStart = parseDate(
    input.weekStart ?? mondayOf(date).toISOString().slice(0, 10),
    'weekStart',
  );
  const weekEnd = addDays(weekStart, 7);

  return {
    month,
    monthFrom,
    monthTo,
    weekStart,
    weekEnd,
    date,
    timezone: TIMEZONE,
  };
}

export function toDateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function addDays(value: Date, days: number): Date {
  return new Date(
    Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate() + days,
    ),
  );
}

function parseDate(raw: string, field: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new BadRequestException(`${field} must match YYYY-MM-DD`);
  }
  const date = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${field} must be a valid date`);
  }
  return date;
}

function mondayOf(value: Date): Date {
  const jsDay = value.getUTCDay();
  const mondayOffset = jsDay === 0 ? -6 : 1 - jsDay;
  return addDays(value, mondayOffset);
}
