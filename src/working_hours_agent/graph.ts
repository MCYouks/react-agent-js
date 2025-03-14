import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { tools } from "./tools.js";

const model = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0,
});

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