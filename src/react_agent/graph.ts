import { AIMessage } from "@langchain/core/messages";
import { RunnableConfig } from "@langchain/core/runnables";
import { MessagesAnnotation, StateGraph } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";

import { ConfigurationSchema, ensureConfiguration } from "./configuration.js";
import { TOOLS } from "./tools.js";
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

Your output will be sent to a calculator agent that will perform all the calculations and complete the pay stub with the actual numerical results.
`;

// Define the function that calls the model for the thinking process
async function callThinkingModel(
  state: typeof MessagesAnnotation.State,
  config: RunnableConfig,
): Promise<typeof MessagesAnnotation.Update> {
  /** Call the LLM powering our thinking agent. **/
  const configuration = ensureConfiguration(config);

  // Use the thinking system prompt
  const model = await loadChatModel(configuration.model);

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

// Define the function that processes the thinking output and passes it to the calculator agent
async function processThinking(
  state: typeof MessagesAnnotation.State,
  config: RunnableConfig,
): Promise<typeof MessagesAnnotation.Update> {
  const messages = state.messages;
  const thinkingOutput = messages[messages.length - 1];
  
  // Get the configuration
  const configuration = ensureConfiguration(config);
  
  // Call the calculator agent with the thinking output
  const calculatorResult = await calculatorGraph.invoke(
    {
      messages: [
        {
          role: "user",
          content: `Please perform all the calculations in the following thinking process and complete the pay stub:\n\n${thinkingOutput.content}`
        }
      ]
    },
    {
      configurable: {
        systemPromptTemplate: configuration.systemPromptTemplate,
        model: configuration.model
      }
    }
  );
  
  // Get the final message from the calculator agent
  const calculatorOutput = calculatorResult.messages[calculatorResult.messages.length - 1];
  
  // Return the calculator output
  return { messages: [calculatorOutput] };
}

// Define a new graph. We use the prebuilt MessagesAnnotation to define state:
// https://langchain-ai.github.io/langgraphjs/concepts/low_level/#messagesannotation
const workflow = new StateGraph(MessagesAnnotation, ConfigurationSchema)
  // Define the nodes in our workflow
  .addNode("callThinkingModel", callThinkingModel)
  .addNode("processThinking", processThinking)
  // Set the entrypoint as `callThinkingModel`
  .addEdge("__start__", "callThinkingModel")
  // After thinking model is called, process the thinking
  .addEdge("callThinkingModel", "processThinking")
  // After processing thinking, end the workflow
  .addEdge("processThinking", "__end__");

// Finally, we compile it!
// This compiles it into a graph you can invoke and deploy.
export const graph = workflow.compile({
  interruptBefore: [], // if you want to update the state before calling the tools
  interruptAfter: [],
});
