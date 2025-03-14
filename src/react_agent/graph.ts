import { RunnableConfig } from "@langchain/core/runnables";
import { MessagesAnnotation, StateGraph, Annotation } from "@langchain/langgraph";
import { ChatAnthropic } from "@langchain/anthropic";
import { ConfigurationSchema, ensureConfiguration } from "./configuration.js";
import { THINKING_TOOLS } from "./tools.js";
import { loadChatModel } from "./utils.js";
import { ANALYZER_PROMPT_TEMPLATE } from "./prompts.js";
import { StringOutputParser } from "@langchain/core/output_parsers";

const StateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  thinkingProcess: Annotation<string>,
  calculationInput: Annotation<string>,
  calculationOutput: Annotation<string>,
  payStub: Annotation<string>,
});

// Model
const model = await loadChatModel("claude-3-5-sonnet-20240620")

// Define the function that calls the model for the thinking process
async function analyzerNode(
  state: typeof StateAnnotation.State,
): Promise<typeof StateAnnotation.Update> {

  const response = await model.invoke([
    {
      role: "system",
      content: ANALYZER_PROMPT_TEMPLATE
    },
    ...state.messages
  ]);

  const stringParser = new StringOutputParser()
  const thinkingProcess = await stringParser.invoke(response)

  
  return {  
    // We return a list, because this will get added to the existing list
    messages: [response], 
    thinkingProcess 
  };
}

// Define a new graph with the ReAct pattern for the thinking agent
const workflow = new StateGraph(MessagesAnnotation, ConfigurationSchema)
  // Define the nodes in our workflow
  .addNode("analyzerNode", analyzerNode)
  // Set the entrypoint as analyzerNode
  .addEdge("__start__", "analyzerNode")

  // After calculator input is prepared, end the workflow
  .addEdge("analyzerNode", "__end__");

// Finally, we compile it!
// This compiles it into a graph you can invoke and deploy.
export const graph = workflow.compile({
  interruptBefore: [], // if you want to update the state before calling the tools
  interruptAfter: [],
});
