import { TriggerType } from "@prisma/client";

/**
 * Trigger Types
 * 
 * Defines the shape of trigger data and configuration for different trigger types.
 */

// Base trigger interface
export interface TriggerMetadata {
  id: string;
  workflowId: string;
  nodeId: string;
  type: TriggerType;
  isActive: boolean;
  config?: unknown;
  createdAt: Date;
  updatedAt: Date;
}

// Webhook-specific trigger configuration
export interface WebhookTriggerConfig {
  method?: "POST" | "GET" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  validateSignature?: boolean;
  secret?: string;
}

// Trigger execution input passed to workflow
export interface TriggerExecutionInput {
  triggerNodeId: string; // Which trigger node to start from
  triggerData: unknown; // Data from the trigger event (e.g., webhook payload)
  metadata?: {
    triggerId: string;
    triggerType: TriggerType;
    timestamp: string;
    source?: string; // Optional: IP address, user agent, etc.
  };
}

// Result of trigger registration
export interface TriggerRegistration {
  triggerId: string;
  webhookUrl?: string; // For webhook triggers
  status: "active" | "inactive";
}

// Trigger validation error
export class TriggerValidationError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = "TriggerValidationError";
  }
}
