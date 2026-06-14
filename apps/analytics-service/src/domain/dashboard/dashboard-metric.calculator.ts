import {
  DashboardCard,
  DashboardMonthlyTrendPoint,
  DashboardPeriod,
  DashboardRawCounts,
} from './admin-dashboard.types';

const CARD_LABELS: Record<DashboardCard['key'], string> = {
  students: 'Tổng Học Viên',
  courses: 'Tổng Khóa Học',
  instructors: 'Giảng Viên',
  completedExams: 'Bài Thi Hoàn Thành',
};

export class DashboardMetricCalculator {
  createPeriod(month?: string, now = new Date()): DashboardPeriod {
    const monthStart = month ? this.parseMonth(month) : startOfMonth(now);
    const nextMonth = addMonths(monthStart, 1);
    const previousMonth = addMonths(monthStart, -1);

    return {
      month: toMonthKey(monthStart),
      currentFrom: monthStart,
      currentTo: nextMonth,
      previousFrom: previousMonth,
      previousTo: monthStart,
    };
  }

  buildCards(counts: DashboardRawCounts): DashboardCard[] {
    return [
      this.card('students', counts.currentStudents, counts.previousStudents),
      this.card('courses', counts.currentCourses, counts.previousCourses),
      this.card(
        'instructors',
        counts.currentInstructors,
        counts.previousInstructors,
      ),
      this.card(
        'completedExams',
        counts.currentCompletedExams,
        counts.previousCompletedExams,
      ),
    ];
  }

  percentage(part: number, total: number): number {
    if (total <= 0) {
      return 0;
    }
    return round((part / total) * 100);
  }

  passRate(passed: number, completed: number): number {
    return this.percentage(passed, completed);
  }

  emptyTrend(
    period: DashboardPeriod,
    months = 6,
  ): DashboardMonthlyTrendPoint[] {
    return Array.from({ length: months }, (_, index) => {
      const date = addMonths(period.currentFrom, index - months + 1);
      return {
        month: toMonthKey(date),
        students: 0,
        completedExams: 0,
        passedExams: 0,
      };
    });
  }

  private card(
    key: DashboardCard['key'],
    value: number,
    previousValue: number,
  ): DashboardCard {
    const diff = value - previousValue;
    return {
      key,
      label: CARD_LABELS[key],
      value,
      previousValue,
      delta: {
        value: diff,
        percentage:
          previousValue === 0 ? null : round((diff / previousValue) * 100),
        direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat',
      },
    };
  }

  private parseMonth(month: string): Date {
    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new Error('month must match YYYY-MM');
    }
    const [year, monthNumber] = month.split('-').map(Number);
    if (monthNumber < 1 || monthNumber > 12) {
      throw new Error('month must match YYYY-MM');
    }
    return new Date(Date.UTC(year, monthNumber - 1, 1));
  }
}

export function toMonthKey(value: Date): string {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}`;
}

function startOfMonth(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

function addMonths(value: Date, months: number): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months, 1),
  );
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
