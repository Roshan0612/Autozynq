import { z, ZodSchema } from "zod";

// Context passed to every node during execution.
// Provides access to input data, node config, auth credentials, and execution metadata.
export interface NodeContext {
  input: unknown; // Data from previous node (null for triggers)
  config: unknown; // Node-specific configuration from workflow JSON
  auth: Record<string, any>; // OAuth tokens / API credentials (mock for now)
  executionId: string; // Current execution ID for logging/debugging
  workflowId: string; // Workflow ID for reference
  userId?: string; // User ID who owns the execution
  stepIndex: number; // Current step number in execution
}

// Base interface that all automation nodes must implement.
// Enforces type safety and validation at the node level.
export interface AutomationNode {
  type: string; // Unique identifier (e.g., "gmail.trigger.newEmail")
  category: "trigger" | "action" | "logic"; // Node category determines workflow position and behavior
  displayName: string; // Human-readable name for UI
  description: string; // Short description of what the node does
  configSchema: ZodSchema; // Validates node.config in workflow definition
  outputSchema: ZodSchema; // Validates data emitted by node.run()
  run(ctx: NodeContext): Promise<unknown>; // Async execution function
}

// Helper type to infer config type from Zod schema
export type InferConfig<T extends ZodSchema> = z.infer<T>;

// Helper type to infer output type from Zod schema
export type InferOutput<T extends ZodSchema> = z.infer<T>;
