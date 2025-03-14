import { startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { groupBy } from 'lodash-es';
import { z } from 'zod';

export const WorkDaySchema = z.object({
  date: z.string(),
  workingHours: z.number(),
});

type WorkDay = z.infer<typeof WorkDaySchema>;

// New unified schema for both weekly and monthly results
export const WorkingHoursResultSchema = z.object({
  start: z.string().describe("The start date"),
  end: z.string().describe("The end date"),
  hours: z.object({
    regular: z.number().describe("Regular hours worked"),
    complementary: z.number().describe("Complementary hours worked"),
    overtime: z.number().describe("Overtime hours worked"),
    total: z.number().describe("Total hours worked"),
  }),
});

export type WorkingHoursResult = z.infer<typeof WorkingHoursResultSchema>;

// Output schema using the unified WorkingHoursResultSchema
export const CalculateWorkingHoursOutputSchema = z.object({
  week: z.array(WorkingHoursResultSchema),
  month: WorkingHoursResultSchema,
});

export type CalculateWorkingHoursOutput = z.infer<typeof CalculateWorkingHoursOutputSchema>;

const LEGAL_WEEKLY_HOURS = 35;

const groupWorkDaysByWeek = (workDays: WorkDay[]) => {
  return groupBy(workDays, (day: WorkDay) => {
    const date = new Date(day.date);
    /**
     * In the date-fns library, the week starts on Sunday (0) by default.
     * 
     * Here is the list of the weekStartsOn values:
     * 0: Sunday (default in US/North American calendar)
     * 1: Monday (commonly used in European calendars and ISO week date standard)
     * 2: Tuesday
     * 3: Wednesday
     * 4: Thursday
     * 5: Friday
6: Saturday
     */
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    return weekStart.toISOString();
  });
};

const calculateWeeklyResults = (weekDays: WorkDay[]): WorkingHoursResult => {
  const totalHours = weekDays.reduce((sum, day) => sum + day.workingHours, 0);
  const regularHours = Math.min(totalHours, LEGAL_WEEKLY_HOURS);
  const complementaryHours = 0; // À ajuster selon les règles spécifiques des heures complémentaires
  const overtimeHours = Math.max(0, totalHours - LEGAL_WEEKLY_HOURS);

  const weekStart = new Date(weekDays[0].date);
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

  return {
    start: weekStart.toISOString(),
    end: weekEnd.toISOString(),
    hours: {
      regular: regularHours,
      complementary: complementaryHours,
      overtime: overtimeHours,
      total: totalHours,
    },
  };
};

const calculateMonthlySummary = (weeklyResults: WorkingHoursResult[]): WorkingHoursResult => {
  const firstWeek = weeklyResults[0];
  const lastWeek = weeklyResults[weeklyResults.length - 1];

  const monthStart = startOfMonth(new Date(firstWeek.start)).toISOString();
  const monthEnd = endOfMonth(new Date(lastWeek.end)).toISOString();

  const totalRegularHours = weeklyResults.reduce((sum, week) => sum + week.hours.regular, 0);
  const totalComplementaryHours = weeklyResults.reduce((sum, week) => sum + week.hours.complementary, 0);
  const totalOvertimeHours = weeklyResults.reduce((sum, week) => sum + week.hours.overtime, 0);
  const totalHours = weeklyResults.reduce((sum, week) => sum + week.hours.total, 0);

  return {
    start: monthStart,
    end: monthEnd,
    hours: {
      regular: totalRegularHours,
      complementary: totalComplementaryHours,
      overtime: totalOvertimeHours,
      total: totalHours,
    },
  };
};

export const CalculateWorkingHoursInputSchema = z.object({
  workDays: z.array(WorkDaySchema)
});

export type CalculateWorkingHoursInput = z.infer<typeof CalculateWorkingHoursInputSchema>;

export const calculateWorkingHours = (input: CalculateWorkingHoursInput): CalculateWorkingHoursOutput => {
  const { workDays } = input;
  const groupedByWeek = groupWorkDaysByWeek(workDays);
  const weeklyResults = Object.values(groupedByWeek).map(calculateWeeklyResults);
  const monthlyResult = calculateMonthlySummary(weeklyResults);

  return { 
    week: weeklyResults, 
    month: monthlyResult 
  };
};

// Exemple d'utilisation
const workDays: WorkDay[] = [
  { date: '2023-10-02', workingHours: 8 },
  { date: '2023-10-03', workingHours: 8 },
  { date: '2023-10-04', workingHours: 8 },
  { date: '2023-10-05', workingHours: 8 },
  { date: '2023-10-06', workingHours: 9 },
  { date: '2023-10-09', workingHours: 10 },
];

const results = calculateWorkingHours({ workDays });
console.log(results.week);
console.log(results.month);
