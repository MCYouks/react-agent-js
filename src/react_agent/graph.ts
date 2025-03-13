import { AIMessage } from "@langchain/core/messages";
import { RunnableConfig } from "@langchain/core/runnables";
import { MessagesAnnotation, StateGraph } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";

import { ConfigurationSchema, ensureConfiguration } from "./configuration.js";
import { THINKING_TOOLS } from "./tools.js";
import { loadChatModel } from "./utils.js";
import { calculatorGraph } from "./calculator_agent.js";

// Define the system prompt for the thinking agent
const THINKING_SYSTEM_PROMPT = `
You are a specialized thinking agent for payroll processing in the construction industry (BTP). Your job is to:

1. Analyze the input data for generating a pay stub for temporary workers
2. Describe in detail your thinking process and all calculation steps needed
3. Explicitly mention all information, numbers, and coefficients that will be used
4. Outline all calculations that need to be performed WITHOUT actually calculating them
5. Structure your response in a clear, step-by-step format following the required sections of a pay stub

Important elements to include in your thinking process:
- Analysis of regular hours and overtime hours for each mission
- Calculation steps for base salary, overtime pay with appropriate rates
- Steps for calculating Indemnité de Fin de Mission (IFM)
- Steps for calculating Indemnité Compensatrice de Congés Payés (ICP)
- All applicable social security contributions and their rates
- Net salary calculation process

For example, instead of writing "The salary is 35 hours × €12/hour = €420", write:
"To calculate the base salary:
- Number of regular hours: 35 hours
- Hourly rate: €12/hour
- Calculation needed: 35 × €12"

For overtime calculations, specify:
"To calculate overtime pay:
- Number of overtime hours: 5 hours
- Hourly rate: €12/hour
- Overtime multiplier: 1.25
- Calculation needed: 5 × €12 × 1.25"

You have access to a search tool that allows you to look up information on the internet. Use this tool when:
- You need to verify specific rates, coefficients, or rules for French payroll processing
- You're unsure about a particular calculation method or legal requirement
- You need up-to-date information about social security contributions

Your final output will be sent to a calculator agent that will perform all the calculations and complete the pay stub with the actual numerical results.
`;

// Define the function that calls the model for the thinking process
async function analyzerNode(
  state: typeof MessagesAnnotation.State,
  config: RunnableConfig,
): Promise<typeof MessagesAnnotation.Update> {
  /** Call the LLM powering our thinking agent. **/
  const configuration = ensureConfiguration(config);

  // Use the thinking system prompt and bind the search tool
  const model = (await loadChatModel(configuration.model)).bindTools(THINKING_TOOLS);

  const response = await model.invoke([
    {
      role: "system",
      content: THINKING_SYSTEM_PROMPT + "\n\n" + configuration.systemPromptTemplate
    },
    ...state.messages,
  ]);

  // We return a list, because this will get added to the existing list
  return { messages: [response] };
}

// Define the function that determines whether to continue or not for the thinking agent
function routeThinkingOutput(state: typeof MessagesAnnotation.State): "researchTool" | "calculatorNode" {
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1];
  // If the LLM is invoking tools, route there.
  if ((lastMessage as AIMessage)?.tool_calls?.length || 0 > 0) {
    return "researchTool";
  }
  // Otherwise, proceed to the calculator input preparation
  else {
    return "calculatorNode";
  }
}

// Define a new graph with the ReAct pattern for the thinking agent
const workflow = new StateGraph(MessagesAnnotation, ConfigurationSchema)
  // Define the nodes in our workflow
  .addNode("analyzerNode", analyzerNode)
  .addNode("researchTool", new ToolNode(THINKING_TOOLS))
  .addNode("calculatorNode", calculatorGraph)
  // Set the entrypoint as analyzerNode
  .addEdge("__start__", "analyzerNode")
  // Add conditional edges for the thinking agent
  .addConditionalEdges(
    "analyzerNode",
    routeThinkingOutput,
    {
      researchTool: "researchTool",
      calculatorNode: "calculatorNode"
    }
  )
  // After using tools, go back to the thinking model
  .addEdge("researchTool", "analyzerNode")
  // After calculator input is prepared, end the workflow
  .addEdge("calculatorNode", "__end__");

// Finally, we compile it!
// This compiles it into a graph you can invoke and deploy.
export const graph = workflow.compile({
  interruptBefore: [], // if you want to update the state before calling the tools
  interruptAfter: [],
});
