import type { AutomationNode } from "./base";
import { gmailNodes } from "./gmail";
import { emailNodes } from "./email";
import { slackNodes } from "./slack";
import { ifConditionNode } from "./logic";
import { googleFormsNodes } from "./google_forms";
import { testPassthroughTrigger } from "./test";
import { webhookTriggerNode } from "./core/webhook.trigger";
import { manualTriggerNode } from "./core/manual.trigger";
import { httpRequestNode } from "./core/http.action";
import { logDebugNode } from "./core/log.action";
import { generateTextAction, generateEmailAction } from "./ai";
import { whatsappNodes } from "./whatsapp";
import { instagramNodes } from "./instagram";

// Central registry of all automation nodes.
// This is the single source of truth for node definitions.
// Adding a new app requires: 1) create folder, 2) add import, 3) spread into registry.
export const nodeRegistry: Record<string, AutomationNode> = {
  ...gmailNodes,
  ...emailNodes,
  ...slackNodes,
  ...googleFormsNodes,
  [ifConditionNode.type]: ifConditionNode,
  [testPassthroughTrigger.type]: testPassthroughTrigger,
   [webhookTriggerNode.type]: webhookTriggerNode,
   [manualTriggerNode.type]: manualTriggerNode,
   [httpRequestNode.type]: httpRequestNode,
   [logDebugNode.type]: logDebugNode,
   [generateTextAction.type]: generateTextAction,
  [generateEmailAction.type]: generateEmailAction,
  ...whatsappNodes,
  ...instagramNodes,
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
