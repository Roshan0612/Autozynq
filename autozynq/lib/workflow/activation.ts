import { prisma } from "../prisma";
import { WorkflowStatus } from "@prisma/client";
import { validateWorkflowDefinition } from "./validate";
import {
  registerWorkflowTriggers,
  deactivateWorkflowTriggers,
  TriggerRegistration,
} from "../triggers";

/**
 * Workflow Activation Service
 * 
 * Handles workflow activation/deactivation lifecycle:
 * - Validates workflow definition
 * - Registers/deactivates triggers
 * - Updates workflow status
 * 
 * This is the single source of truth for workflow activation.
 */

export interface ActivationResult {
  workflowId: string;
  status: WorkflowStatus;
  triggers: TriggerRegistration[];
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
 * 3. Register all trigger nodes
 * 4. Return trigger URLs for external services
 * 
 * @param workflowId - Workflow to activate
 * @param userId - User performing activation (for authorization)
 * @returns Activation result with trigger URLs
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
    // Re-register triggers to ensure consistency
    const triggers = await registerWorkflowTriggers(workflowId);

    return {
      workflowId,
      status: "ACTIVE",
      triggers,
      message: "Workflow is already active. Triggers have been refreshed.",
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
  // STEP 2: Register triggers
  // ============================================================================

  let triggers: TriggerRegistration[];
  try {
    triggers = await registerWorkflowTriggers(workflowId);
  } catch (error) {
    throw new WorkflowActivationError(
      `Failed to register triggers: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { workflowId, triggerError: error }
    );
  }

  // ============================================================================
  // STEP 3: Update workflow status
  // ============================================================================

  await prisma.workflow.update({
    where: { id: workflowId },
    data: { status: "ACTIVE" },
  });

  console.log(`[Activation] Workflow activated: ${workflowId}`);
  console.log(`[Activation] Registered ${triggers.length} trigger(s)`);

  return {
    workflowId,
    status: "ACTIVE",
    triggers,
    message: `Workflow activated successfully with ${triggers.length} trigger(s)`,
  };
}

// ============================================================================
// DEACTIVATION
// ============================================================================

/**
 * Deactivate a workflow.
 * 
 * This performs the following operations:
 * 1. Update workflow status to PAUSED
 * 2. Deactivate all triggers (stop accepting events)
 * 
 * Triggers are not deleted to preserve history and allow reactivation.
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
      triggers: [],
      message: `Workflow is already inactive (status: ${workflow.status})`,
    };
  }

  // ============================================================================
  // STEP 1: Deactivate triggers
  // ============================================================================

  await deactivateWorkflowTriggers(workflowId);

  // ============================================================================
  // STEP 2: Update workflow status
  // ============================================================================

  await prisma.workflow.update({
    where: { id: workflowId },
    data: { status: "PAUSED" },
  });

  console.log(`[Deactivation] Workflow deactivated: ${workflowId}`);

  return {
    workflowId,
    status: "PAUSED",
    triggers: [],
    message: "Workflow deactivated successfully. Triggers are now inactive.",
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
