import { AIMessage } from "@langchain/core/messages";
import { RunnableConfig } from "@langchain/core/runnables";
import { MessagesAnnotation, StateGraph } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";

import { ConfigurationSchema, ensureConfiguration } from "./configuration.js";
import { Calculator } from "@langchain/community/tools/calculator";
import { loadChatModel } from "./utils.js";

// Define the calculator tool
const CALCULATOR_TOOLS = [new Calculator()];

// Define the system prompt for the calculator agent
const CALCULATOR_SYSTEM_PROMPT = `
You are a specialized calculator agent for payroll processing. Your job is to:

1. Receive a detailed thinking process with calculation steps from the main agent
2. Perform all the calculations mentioned in the thinking process using the calculator tool
3. Return the complete thinking process with the correct numerical results inserted

Follow these guidelines:
- Use the calculator tool for ALL calculations to ensure accuracy
- Maintain the same structure and flow as the original thinking process
- Insert the calculated results at the appropriate places in the thinking process
- Format currency values with 2 decimal places (e.g., €1,234.56)
- Be precise and thorough in your calculations
- Include all the required sections of the pay stub as outlined in the original thinking process
- Make sure to calculate all components: base salary, overtime, bonuses, deductions, etc.
- Ensure the final JSON output with the net salary is included at the end

For example, if the input says:
"To calculate the salary:
- Number of regular hours: 35 hours
- Hourly rate: €12/hour
- Calculation needed: 35 × €12"

Your response should be:
"To calculate the salary:
- Number of regular hours: 35 hours
- Hourly rate: €12/hour
- Calculation: 35 × €12 = €420.00"

Your output should be a complete, calculated version of the input thinking process, ending with the final pay stub and JSON output.
`;

// Define the function that calls the model for the calculator agent
async function calculatorCallModel(
  state: typeof MessagesAnnotation.State,
  config: RunnableConfig,
): Promise<typeof MessagesAnnotation.Update> {
  const configuration = ensureConfiguration(config);

  const model = (await loadChatModel(configuration.model)).bindTools(CALCULATOR_TOOLS);

  const response = await model.invoke([
    {
      role: "system",
      content: CALCULATOR_SYSTEM_PROMPT
    },
    ...state.messages,
  ]);

  return { messages: [response] };
}

// Define the function that determines whether to continue or not
function calculatorRouteModelOutput(state: typeof MessagesAnnotation.State): string {
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1];
  // If the LLM is invoking tools, route there.
  if ((lastMessage as AIMessage)?.tool_calls?.length || 0 > 0) {
    return "calculatorTools";
  }
  // Otherwise end the graph.
  else {
    return "__end__";
  }
}

// Define the calculator agent graph
const calculatorWorkflow = new StateGraph(MessagesAnnotation, ConfigurationSchema)
  .addNode("calculatorCallModel", calculatorCallModel)
  .addNode("calculatorTools", new ToolNode(CALCULATOR_TOOLS))
  .addEdge("__start__", "calculatorCallModel")
  .addConditionalEdges(
    "calculatorCallModel",
    calculatorRouteModelOutput,
  )
  .addEdge("calculatorTools", "calculatorCallModel");

// Compile the calculator agent graph
export const calculatorGraph = calculatorWorkflow.compile({
  interruptBefore: [],
  interruptAfter: [],
}); 