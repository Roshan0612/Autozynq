import type { AutomationNode } from "./base";
import { gmailNodes } from "./gmail";
import { slackNodes } from "./slack";
import { ifConditionNode } from "./logic";
import { testPassthroughTrigger } from "./test";

// Central registry of all automation nodes.
// This is the single source of truth for node definitions.
// Adding a new app requires: 1) create folder, 2) add import, 3) spread into registry.
export const nodeRegistry: Record<string, AutomationNode> = {
  ...gmailNodes,
  ...slackNodes,
  [ifConditionNode.type]: ifConditionNode,
  [testPassthroughTrigger.type]: testPassthroughTrigger,
};

// Helper to safely retrieve a node definition with error handling.
// Used by validator and execution engine.
export function getNode(type: string): AutomationNode {
  const node = nodeRegistry[type];
  if (!node) {
    throw new Error(`Unknown node type: ${type}`);
  }
  return node;
}

// Helper to check if a node type exists without throwing.
export function hasNode(type: string): boolean {
  return type in nodeRegistry;
}

// Helper to list all registered node types.
export function listNodeTypes(): string[] {
  return Object.keys(nodeRegistry);
}

// Helper to get all nodes by category.
export function getNodesByCategory(category: "trigger" | "action" | "logic"): AutomationNode[] {
  return Object.values(nodeRegistry).filter((node) => node.category === category);
}
