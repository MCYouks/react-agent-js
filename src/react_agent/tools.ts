/**
 * This file defines the tools available to the ReAct agent.
 * Tools are functions that the agent can use to interact with external systems or perform specific tasks.
 */
import { Calculator } from "@langchain/community/tools/calculator";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";

/**
 * Calculator tool
 * This tool allows the agent to perform mathematical calculations.
 */
const calculator = new Calculator();

/**
 * Tavily search tool configuration
 * This tool allows the agent to perform web searches using the Tavily API.
 */
const searchTavily = new TavilySearchResults({
  maxResults: 3,
});

/**
 * Export an array of calculator tools for the calculator agent
 */
export const CALCULATOR_TOOLS = [calculator];

/**
 * Export an array of thinking tools for the thinking agent
 * These tools allow the thinking agent to search for information
 */
export const THINKING_TOOLS = [searchTavily, calculator];

/**
 * Export an array of all available tools
 * Add new tools to this array to make them available to the agent
 *
 * Note: You can create custom tools by implementing the Tool interface from @langchain/core/tools
 * and add them to this array.
 * See https://js.langchain.com/docs/how_to/custom_tools/#tool-function for more information.
 */
export const TOOLS = [calculator];
