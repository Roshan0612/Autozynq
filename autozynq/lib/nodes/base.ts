import { z, ZodSchema } from "zod";

// Field descriptor for dynamic output introspection
export interface OutputField {
  key: string; // Field key in output object (e.g., "email", "name")
  label: string; // Human-readable label for UI
  type: "string" | "number" | "boolean" | "object" | "array"; // Data type
  description?: string; // Optional description
}

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
  // NEW: Access to previous node outputs for template resolution
  previousOutputs?: Record<string, unknown>; // { nodeId: output }
  // Execution mode: live (real runs) vs test (explicit “Test Trigger”)
  executionMode?: "live" | "test";
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
  
  // UI Metadata
  app?: string; // App/integration name (e.g., "Google Sheets", "Gmail")
  icon?: string; // Icon name or URL (optional)
  
  // NEW: Dynamic output field introspection (used by UI for field picker)
  outputFields: OutputField[]; // Static output fields (can be overridden dynamically)
  
  // NEW: Connection requirements
  requiresConnection: boolean; // Does this node need an OAuth connection?
  provider?: "google" | "gmail" | "instagram" | "slack"; // Provider for connection lookup
  
  run(ctx: NodeContext): Promise<unknown>; // Async execution function
  
  // NEW: Optional method to fetch dynamic output fields at runtime
  // Used when output schema depends on external data (e.g., Google Form fields)
  getDynamicOutputFields?(
    config: unknown,
    userId: string
  ): Promise<OutputField[]>;
}

// Helper type to infer config type from Zod schema
export type InferConfig<T extends ZodSchema> = z.infer<T>;

// Helper type to infer output type from Zod schema
export type InferOutput<T extends ZodSchema> = z.infer<T>;
