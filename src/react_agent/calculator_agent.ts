import { AIMessage } from "@langchain/core/messages";
import { RunnableConfig } from "@langchain/core/runnables";
import { MessagesAnnotation, StateGraph } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";

import { ConfigurationSchema, ensureConfiguration } from "./configuration.js";
import { CALCULATOR_TOOLS } from "./tools.js";
import { loadChatModel } from "./utils.js";

// Define the system prompt for the calculator agent
const CALCULATOR_SYSTEM_PROMPT = `
Vous êtes un agent calculateur spécialisé pour le traitement de la paie. Votre travail consiste à :

1. Recevoir un processus de réflexion détaillé avec les étapes de calcul de l'agent principal
2. Effectuer tous les calculs mentionnés dans le processus de réflexion en utilisant l'outil calculatrice
3. Retourner le processus de réflexion complet avec les résultats numériques corrects insérés

Suivez ces directives :
- Utilisez l'outil calculatrice pour TOUS les calculs afin d'assurer la précision
- Maintenez la même structure et le même flux que le processus de réflexion original
- Insérez les résultats calculés aux endroits appropriés dans le processus de réflexion
- Formatez les valeurs monétaires avec 2 décimales (par exemple, €1 234,56)
- Soyez précis et minutieux dans vos calculs
- Incluez toutes les sections requises de la fiche de paie comme indiqué dans le processus de réflexion original
- Assurez-vous de calculer tous les composants : salaire de base, heures supplémentaires, primes, déductions, etc.
- Assurez-vous que la sortie JSON finale avec le salaire net est incluse à la fin

Par exemple, si l'entrée indique :
"Pour calculer le salaire :
- Nombre d'heures régulières : 35 heures
- Taux horaire : €12/heure
- Calcul nécessaire : 35 × €12"

Votre réponse devrait être :
"Pour calculer le salaire :
- Nombre d'heures régulières : 35 heures
- Taux horaire : €12/heure
- Calcul : 35 × €12 = €420,00"

Votre sortie doit être une version complète et calculée du processus de réflexion d'entrée, se terminant par la fiche de paie finale et la sortie JSON.
`;

// Define the function that calls the model for the calculator agent
async function calculatorCallModel(
  state: typeof MessagesAnnotation.State,
  config: RunnableConfig,
): Promise<typeof MessagesAnnotation.Update> {
  const configuration = ensureConfiguration(config);

  const model = (await loadChatModel(configuration.model)).bindTools(CALCULATOR_TOOLS);

  const lastMessage = state.messages[state.messages.length - 1];

  console.log("lastMessage", lastMessage);

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