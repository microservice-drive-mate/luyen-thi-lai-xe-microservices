import { DashboardMetricCalculator } from './dashboard-metric.calculator';

describe('DashboardMetricCalculator', () => {
  const calculator = new DashboardMetricCalculator();

  it('creates calendar month windows for current and previous month', () => {
    const period = calculator.createPeriod('2026-06');

    expect(period.month).toBe('2026-06');
    expect(period.currentFrom.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    expect(period.currentTo.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect(period.previousFrom.toISOString()).toBe('2026-05-01T00:00:00.000Z');
    expect(period.previousTo.toISOString()).toBe('2026-06-01T00:00:00.000Z');
  });

  it('calculates deltas, percentages, and pass rates', () => {
    const cards = calculator.buildCards({
      currentStudents: 120,
      previousStudents: 100,
      currentCourses: 9,
      previousCourses: 10,
      currentInstructors: 5,
      previousInstructors: 5,
      currentCompletedExams: 8,
      previousCompletedExams: 0,
    });

    expect(cards.find((card) => card.key === 'students')?.delta).toEqual({
      value: 20,
      percentage: 20,
      direction: 'up',
    });
    expect(cards.find((card) => card.key === 'courses')?.delta).toEqual({
      value: -1,
      percentage: -10,
      direction: 'down',
    });
    expect(cards.find((card) => card.key === 'instructors')?.delta).toEqual({
      value: 0,
      percentage: 0,
      direction: 'flat',
    });
    expect(cards.find((card) => card.key === 'completedExams')?.delta).toEqual({
      value: 8,
      percentage: null,
      direction: 'up',
    });
    expect(calculator.percentage(1, 4)).toBe(25);
    expect(calculator.passRate(7, 10)).toBe(70);
  });

  it('returns empty trend points for the requested window', () => {
    const period = calculator.createPeriod('2026-06');

    expect(calculator.emptyTrend(period, 3)).toEqual([
      { month: '2026-04', students: 0, completedExams: 0, passedExams: 0 },
      { month: '2026-05', students: 0, completedExams: 0, passedExams: 0 },
      { month: '2026-06', students: 0, completedExams: 0, passedExams: 0 },
    ]);
  });
});
