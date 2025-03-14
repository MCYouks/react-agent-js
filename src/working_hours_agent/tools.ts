import { tool } from "@langchain/core/tools";
import { calculateWorkingHours, CalculateWorkingHoursInputSchema } from "./calculator.js";

const calculateWorkingHoursTool = tool(
  calculateWorkingHours,
  {
    name: "calculateWorkingHours",
    description: "Calculate the distribution of working hours for an employee",
    schema: CalculateWorkingHoursInputSchema
  }
);

export const tools = [calculateWorkingHoursTool];