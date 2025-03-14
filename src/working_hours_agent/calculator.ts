import { startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { groupBy, sortBy } from 'lodash-es';
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

const calculateWeeklyResults = (workDays: WorkDay[], contractualWeeklyHours: number): WorkingHoursResult => {
  const sortedWorkDays = sortBy(workDays, (day) => new Date(day.date));
  const totalHours = sortedWorkDays.reduce((sum, day) => sum + day.workingHours, 0);
  
  // Calcul des heures régulières (limitées aux heures contractuelles)
  const regularHours = Math.min(totalHours, contractualWeeklyHours);
  
  // Calcul des heures complémentaires (entre les heures contractuelles et 35h)
  const complementaryHours = contractualWeeklyHours < LEGAL_WEEKLY_HOURS 
    ? Math.min(Math.max(0, totalHours - contractualWeeklyHours), LEGAL_WEEKLY_HOURS - contractualWeeklyHours)
    : 0;
  
  // Calcul des heures supplémentaires (au-delà de 35h)
  const overtimeHours = Math.max(0, totalHours - LEGAL_WEEKLY_HOURS);

  const weekStart = new Date(sortedWorkDays[0].date);
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
  const sortedWeeklyResults = sortBy(weeklyResults, (week) => new Date(week.start));

  const firstWeek = sortedWeeklyResults[0];
  const lastWeek = sortedWeeklyResults[sortedWeeklyResults.length - 1];

  const monthStart = startOfMonth(new Date(firstWeek.start)).toISOString();
  const monthEnd = endOfMonth(new Date(lastWeek.end)).toISOString();

  const totalRegularHours = sortedWeeklyResults.reduce((sum, week) => sum + week.hours.regular, 0);
  const totalComplementaryHours = sortedWeeklyResults.reduce((sum, week) => sum + week.hours.complementary, 0);
  const totalOvertimeHours = sortedWeeklyResults.reduce((sum, week) => sum + week.hours.overtime, 0);
  const totalHours = sortedWeeklyResults.reduce((sum, week) => sum + week.hours.total, 0);

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
  workDays: z.array(WorkDaySchema),
  contractualWeeklyHours: z.number().default(35).describe("Heures hebdomadaires prévues au contrat")
});

export type CalculateWorkingHoursInput = z.infer<typeof CalculateWorkingHoursInputSchema>;

export const calculateWorkingHours = (input: CalculateWorkingHoursInput): CalculateWorkingHoursOutput => {
  const { workDays, contractualWeeklyHours } = input;
  const groupedByWeek = groupWorkDaysByWeek(workDays);
  const weeklyResults = Object.values(groupedByWeek).map(weekWorkDays => 
    calculateWeeklyResults(weekWorkDays, contractualWeeklyHours)
  );
  const monthlyResult = calculateMonthlySummary(weeklyResults);

  return { 
    week: weeklyResults, 
    month: monthlyResult 
  };
};

// Exemple d'utilisation mis à jour
const workDays: WorkDay[] = [
  { date: '2023-10-02', workingHours: 8 },
  { date: '2023-10-03', workingHours: 8 },
  { date: '2023-10-04', workingHours: 8 },
  { date: '2023-10-05', workingHours: 8 },
  { date: '2023-10-06', workingHours: 9 },
  { date: '2023-10-09', workingHours: 10 },
];

// Exemple avec un contrat à temps partiel de 28h par semaine
const results = calculateWorkingHours({ workDays, contractualWeeklyHours: 28 });
console.log(results.week);
console.log(results.month);
