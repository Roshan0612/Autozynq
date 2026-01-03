import { prisma } from "../prisma";
import { TriggerType } from "@prisma/client";
import { getNode } from "../nodes/registry";
import { WorkflowDefinition } from "../workflow/schema";
import {
  TriggerMetadata,
  TriggerRegistration,
  TriggerValidationError,
} from "./types";

/**
 * Trigger Service
 * 
 * Manages trigger lifecycle:
 * - Registration when workflow is activated
 * - Deactivation when workflow is paused/deactivated
 * - Lookup for incoming webhook events
 * 
 * This service is the bridge between external events and workflow execution.
 */

// ============================================================================
// TRIGGER REGISTRATION
// ============================================================================

/**
 * Register all trigger nodes for a workflow when it's activated.
 * 
 * This creates a public trigger entry for each trigger node in the workflow,
 * allowing external events to invoke the workflow.
 * 
 * @param workflowId - Workflow to register triggers for
 * @returns Array of trigger registrations with public URLs
 */
export async function registerWorkflowTriggers(
  workflowId: string
): Promise<TriggerRegistration[]> {
  // Fetch workflow with definition
  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
  });

  if (!workflow) {
    throw new Error(`Workflow not found: ${workflowId}`);
  }

  const definition = workflow.definition as WorkflowDefinition;
  const registrations: TriggerRegistration[] = [];

  // Find all trigger nodes in workflow definition
  const triggerNodes = definition.nodes.filter((node) => {
    try {
      const nodeDef = getNode(node.type);
      return nodeDef.category === "trigger";
    } catch {
      return false; // Skip if node type doesn't exist
    }
  });

  if (triggerNodes.length === 0) {
    throw new TriggerValidationError("Workflow has no trigger nodes");
  }

  // Register each trigger node
  for (const triggerNode of triggerNodes) {
    const nodeDef = getNode(triggerNode.type);

    // Determine trigger type based on node type
    // For now, all triggers are webhooks (extensible for future types)
    const triggerType: TriggerType = determineTriggerType(nodeDef.type);

    // Check if trigger already exists
    let trigger = await prisma.workflowTrigger.findUnique({
      where: {
        workflowId_nodeId: {
          workflowId,
          nodeId: triggerNode.id,
        },
      },
    });

    if (trigger) {
      // Reactivate existing trigger
      trigger = await prisma.workflowTrigger.update({
        where: { id: trigger.id },
        data: {
          isActive: true,
          config: triggerNode.config,
        },
      });
    } else {
      // Create new trigger
      trigger = await prisma.workflowTrigger.create({
        data: {
          workflowId,
          nodeId: triggerNode.id,
          type: triggerType,
          isActive: true,
          config: triggerNode.config,
        },
      });
    }

    // Build registration response
    const registration: TriggerRegistration = {
      triggerId: trigger.id,
      status: trigger.isActive ? "active" : "inactive",
    };

    // Add webhook URL for webhook triggers
    if (triggerType === "WEBHOOK") {
      registration.webhookUrl = buildWebhookUrl(trigger.id);
    }

    registrations.push(registration);
  }

  return registrations;
}

/**
 * Deactivate all triggers for a workflow.
 * 
 * Called when workflow is paused or deactivated.
 * Triggers are not deleted to preserve history and allow reactivation.
 * 
 * @param workflowId - Workflow to deactivate triggers for
 */
export async function deactivateWorkflowTriggers(
  workflowId: string
): Promise<void> {
  await prisma.workflowTrigger.updateMany({
    where: { workflowId },
    data: { isActive: false },
  });
}

// ============================================================================
// TRIGGER LOOKUP
// ============================================================================

/**
 * Get trigger metadata by trigger ID.
 * 
 * Used by webhook handler to resolve which workflow to execute.
 * 
 * @param triggerId - Public trigger ID from webhook URL
 * @returns Trigger metadata with workflow information
 */
export async function getTriggerById(
  triggerId: string
): Promise<TriggerMetadata | null> {
  const trigger = await prisma.workflowTrigger.findUnique({
    where: { id: triggerId },
    include: {
      workflow: true,
    },
  });

  if (!trigger) {
    return null;
  }

  return {
    id: trigger.id,
    workflowId: trigger.workflowId,
    nodeId: trigger.nodeId,
    type: trigger.type,
    isActive: trigger.isActive,
    config: trigger.config as unknown,
    createdAt: trigger.createdAt,
    updatedAt: trigger.updatedAt,
  };
}

/**
 * Validate that a trigger is active and ready to receive events.
 * 
 * @param trigger - Trigger metadata to validate
 * @throws TriggerValidationError if trigger is not valid
 */
export async function validateTriggerActive(
  trigger: TriggerMetadata
): Promise<void> {
  if (!trigger.isActive) {
    throw new TriggerValidationError(
      `Trigger is not active: ${trigger.id}`,
      { triggerId: trigger.id }
    );
  }

  // Verify workflow is still active
  const workflow = await prisma.workflow.findUnique({
    where: { id: trigger.workflowId },
  });

  if (!workflow) {
    throw new TriggerValidationError(
      `Workflow not found: ${trigger.workflowId}`,
      { triggerId: trigger.id, workflowId: trigger.workflowId }
    );
  }

  if (workflow.status !== "ACTIVE") {
    throw new TriggerValidationError(
      `Workflow is not active: ${trigger.workflowId} (status: ${workflow.status})`,
      {
        triggerId: trigger.id,
        workflowId: trigger.workflowId,
        status: workflow.status,
      }
    );
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Determine trigger type from node type.
 * 
 * Maps node type strings to TriggerType enum.
 * Extensible for future trigger types (schedule, email, etc.)
 * 
 * @param nodeType - Node type string (e.g., "gmail.trigger.newEmail")
 * @returns TriggerType enum value
 */
function determineTriggerType(nodeType: string): TriggerType {
  // For now, all triggers are webhooks
  // In the future, we can parse nodeType to determine:
  // - "*.trigger.schedule" → SCHEDULE
  // - "*.trigger.email" → EMAIL
  // - Everything else → WEBHOOK
  
  if (nodeType.includes("schedule")) {
    return "SCHEDULE";
  }
  
  if (nodeType.includes("email")) {
    return "EMAIL";
  }

  return "WEBHOOK";
}

/**
 * Build public webhook URL from trigger ID.
 * 
 * @param triggerId - Trigger ID
 * @returns Full webhook URL
 */
function buildWebhookUrl(triggerId: string): string {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  return `${baseUrl}/api/webhooks/${triggerId}`;
}

// ============================================================================
// BULK OPERATIONS
// ============================================================================

/**
 * Get all active triggers for a workflow.
 * 
 * @param workflowId - Workflow ID
 * @returns Array of trigger metadata
 */
export async function getWorkflowTriggers(
  workflowId: string
): Promise<TriggerMetadata[]> {
  const triggers = await prisma.workflowTrigger.findMany({
    where: { workflowId },
    orderBy: { createdAt: "asc" },
  });

  return triggers.map((trigger) => ({
    id: trigger.id,
    workflowId: trigger.workflowId,
    nodeId: trigger.nodeId,
    type: trigger.type,
    isActive: trigger.isActive,
    config: trigger.config as unknown,
    createdAt: trigger.createdAt,
    updatedAt: trigger.updatedAt,
  }));
}

/**
 * Delete all triggers for a workflow.
 * 
 * Only use this when permanently deleting a workflow.
 * For temporary deactivation, use deactivateWorkflowTriggers instead.
 * 
 * @param workflowId - Workflow ID
 */
export async function deleteWorkflowTriggers(
  workflowId: string
): Promise<void> {
  await prisma.workflowTrigger.deleteMany({
    where: { workflowId },
  });
}
