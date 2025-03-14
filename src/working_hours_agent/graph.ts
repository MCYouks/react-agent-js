import { tool } from "@langchain/core/tools";
import { ChatOpenAI } from "@langchain/openai";
import { calculateWorkingHours, CalculateWorkingHoursInputSchema } from "./calculator.js";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

const model = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0,
});


const calculateWorkingHoursTool = tool(
  calculateWorkingHours,
  {
    name: "calculateWorkingHours",
    description: "Calculate the distribution of working hours for an employee",
    schema: CalculateWorkingHoursInputSchema
  }
);

const tools = [calculateWorkingHoursTool];

// Augment the LLM with tools
const llm = model.bindTools(tools);

// Invoke the LLM with input that triggers the tool call
const message = await llm.invoke(`Calculate the distribution of working hours for the following employee:
  
  [
    { date: '2023-10-02', workingHours: 8 },
    { date: '2023-10-03', workingHours: 8 },
    { date: '2023-10-04', workingHours: 8 },
    { date: '2023-10-05', workingHours: 8 },
    { date: '2023-10-06', workingHours: 9 },
    { date: '2023-10-09', workingHours: 10 },
  ]
  `);

console.log(message.tool_calls);

export const graph = createReactAgent({
  llm,
  tools,
});

// const result = await agent.invoke({ 
//   messages: [
//     {
//       role: "user",
//       content: `Calculate the distribution of working hours for the following employee:
      
//       [
//         { date: '2023-10-02', workingHours: 8 },
//         { date: '2023-10-03', workingHours: 8 },
//         { date: '2023-10-04', workingHours: 8 },
//         { date: '2023-10-05', workingHours: 8 },
//         { date: '2023-10-06', workingHours: 9 },
//         { date: '2023-10-09', workingHours: 10 },
//       ]
//       `
//     }
//   ] 
// });