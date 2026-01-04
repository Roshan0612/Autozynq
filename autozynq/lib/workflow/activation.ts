import { prisma } from "../prisma";
import { WorkflowStatus } from "@prisma/client";
import { validateWorkflowDefinition } from "./validate";
import {
  getTriggerNodeFromDefinition,
  type WorkflowDefinition,
} from "./schema";
import {
  createTriggerSubscription,
  getWorkflowSubscriptions,
  deleteTriggerSubscription,
} from "../triggers/subscriptions";

/**
 * Workflow Activation Service
 * 
 * Handles workflow activation/deactivation lifecycle:
 * - Validates workflow definition
 * - Registers/deactivates trigger subscriptions
 * - Updates workflow status
 * 
 * This is the single source of truth for workflow activation.
 */

export interface ActivationResult {
  workflowId: string;
  status: WorkflowStatus;
  webhookUrl?: string;
  message: string;
}

export class WorkflowActivationError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = "WorkflowActivationError";
  }
}

// ============================================================================
// ACTIVATION
// ============================================================================

/**
 * Activate a workflow.
 * 
 * This performs the following operations:
 * 1. Validate workflow definition
 * 2. Update workflow status to ACTIVE
 * 3. Register trigger subscription
 * 4. Return webhook URL for external services
 * 
 * @param workflowId - Workflow to activate
 * @param userId - User performing activation (for authorization)
 * @returns Activation result with webhook URL
 */
export async function activateWorkflow(
  workflowId: string,
  userId?: string
): Promise<ActivationResult> {
  // Fetch workflow
  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
  });

  if (!workflow) {
    throw new WorkflowActivationError(`Workflow not found: ${workflowId}`);
  }

  // Verify user owns workflow (if userId provided)
  if (userId && workflow.userId !== userId) {
    throw new WorkflowActivationError(
      `Unauthorized: User ${userId} does not own workflow ${workflowId}`,
      { workflowId, userId }
    );
  }

  // Check if already active
  if (workflow.status === "ACTIVE") {
    const subscriptions = await getWorkflowSubscriptions(workflowId);
    const webhookUrl = subscriptions[0]
      ? `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/webhooks/${subscriptions[0].webhookPath}`
      : undefined;

    return {
      workflowId,
      status: "ACTIVE",
      webhookUrl,
      message: "Workflow is already active.",
    };
  }

  // ============================================================================
  // STEP 1: Validate workflow definition
  // ============================================================================

  try {
    validateWorkflowDefinition(workflow.definition);
  } catch (error) {
    throw new WorkflowActivationError(
      `Cannot activate workflow with invalid definition: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { workflowId, validationError: error }
    );
  }

  // ============================================================================
  // STEP 2: Find trigger node and create subscription
  // ============================================================================

  const definition = workflow.definition as WorkflowDefinition;
  const triggerNode = getTriggerNodeFromDefinition(definition);

  if (!triggerNode) {
    throw new WorkflowActivationError(
      "No trigger node found in workflow definition",
      { workflowId }
    );
  }

  let subscription;
  try {
    subscription = await createTriggerSubscription({
      workflowId,
      nodeId: triggerNode.id,
      triggerType: "webhook",
    });
  } catch (error) {
    throw new WorkflowActivationError(
      `Failed to create trigger subscription: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { workflowId, subscriptionError: error }
    );
  }

  // ============================================================================
  // STEP 3: Update workflow status
  // ============================================================================

  await prisma.workflow.update({
    where: { id: workflowId },
    data: { status: "ACTIVE" },
  });

  const webhookUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/webhooks/${subscription.webhookPath}`;

  console.log(`[Activation] Workflow activated: ${workflowId}`);
  console.log(`[Activation] Webhook URL: ${webhookUrl}`);

  return {
    workflowId,
    status: "ACTIVE",
    webhookUrl,
    message: "Workflow activated successfully with webhook trigger",
  };
}

// ============================================================================
// DEACTIVATION
// ============================================================================

/**
 * Deactivate a workflow.
 * 
 * This performs the following operations:
 * 1. Delete all trigger subscriptions
 * 2. Update workflow status to PAUSED
 * 
 * @param workflowId - Workflow to deactivate
 * @param userId - User performing deactivation (for authorization)
 */
export async function deactivateWorkflow(
  workflowId: string,
  userId?: string
): Promise<ActivationResult> {
  // Fetch workflow
  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
  });

  if (!workflow) {
    throw new WorkflowActivationError(`Workflow not found: ${workflowId}`);
  }

  // Verify user owns workflow (if userId provided)
  if (userId && workflow.userId !== userId) {
    throw new WorkflowActivationError(
      `Unauthorized: User ${userId} does not own workflow ${workflowId}`,
      { workflowId, userId }
    );
  }

  // Check if already inactive
  if (workflow.status !== "ACTIVE") {
    return {
      workflowId,
      status: workflow.status,
      message: `Workflow is already inactive (status: ${workflow.status})`,
    };
  }

  // ============================================================================
  // STEP 1: Delete all trigger subscriptions
  // ============================================================================

  const subscriptions = await getWorkflowSubscriptions(workflowId);
  for (const subscription of subscriptions) {
    await deleteTriggerSubscription(subscription.id);
  }


  // ============================================================================
  // STEP 2: Update workflow status
  // ============================================================================

  await prisma.workflow.update({
    where: { id: workflowId },
    data: { status: "PAUSED" },
  });

  console.log(`[Deactivation] Workflow deactivated: ${workflowId}`);
  console.log(`[Deactivation] Removed ${subscriptions.length} subscription(s)`);

  return {
    workflowId,
    status: "PAUSED",
    message: `Workflow deactivated. Removed ${subscriptions.length} trigger subscription(s)`,
  };
}

// ============================================================================
// STATUS MANAGEMENT
// ============================================================================

/**
 * Toggle workflow status between ACTIVE and PAUSED.
 * 
 * @param workflowId - Workflow to toggle
 * @param userId - User performing action (for authorization)
 * @returns New workflow status
 */
export async function toggleWorkflowStatus(
  workflowId: string,
  userId?: string
): Promise<ActivationResult> {
  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
  });

  if (!workflow) {
    throw new WorkflowActivationError(`Workflow not found: ${workflowId}`);
  }

  if (workflow.status === "ACTIVE") {
    return deactivateWorkflow(workflowId, userId);
  } else {
    return activateWorkflow(workflowId, userId);
  }
}
