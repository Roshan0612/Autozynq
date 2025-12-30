import type { AutomationNode } from "./base";

// Re-export core types and registry functions
export { nodeRegistry, getNode, hasNode, listNodeTypes, getNodesByCategory } from "./registry";
export type { AutomationNode, NodeContext, InferConfig, InferOutput } from "./base";
