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
import { generateRandomId } from "../utils";
import { getLatestResponseId } from "../integrations/google/forms";
import { connectionHasScopes } from "../integrations/google/auth";

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

  // Determine trigger type from node type
  const nodeType = (triggerNode as any).nodeType || (triggerNode as any).type;
  let triggerType: "webhook" | "google_forms" = "webhook";
  if (nodeType?.includes("google_forms")) {
    triggerType = "google_forms";
  }

  let subscription;
  if (triggerType === "webhook") {
    try {
      subscription = await createTriggerSubscription({
        workflowId,
        nodeId: triggerNode.id,
        triggerType,
      });
    } catch (error) {
      throw new WorkflowActivationError(
        `Failed to create trigger subscription: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { workflowId, subscriptionError: error }
      );
    }
  } else {
    // Google Forms trigger: ensure a polling trigger record exists and seeded
    const formId = (triggerNode as any).config?.formId;
    const connectionId = (triggerNode as any).config?.connectionId;
    if (!formId || !connectionId) {
      throw new WorkflowActivationError("Google Forms trigger requires formId and connectionId in config", { triggerNode });
    }

    // UX guardrail: verify Google scopes before allowing activation
    const connection = await prisma.connection.findUnique({ where: { id: connectionId } });
    const grantedScope = (connection?.metadata as any)?.scope as string | undefined;
    const requiredScopes = [
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/forms.body.readonly",
      "https://www.googleapis.com/auth/forms.responses.readonly",
    ];
    if (!connection || !connectionHasScopes(grantedScope, requiredScopes)) {
      throw new WorkflowActivationError(
        "Reconnect Google with Drive + Forms permissions before activating",
        { requiredScopes }
      );
    }

    const latestResponseId = await getLatestResponseId(connectionId, formId);

    await prisma.googleFormsTrigger.upsert({
      where: { workflowId },
      update: {
        formId,
        connectionId,
        lastResponseId: latestResponseId,
        lastCheckedAt: new Date(),
        active: true,
      },
      create: {
        triggerId: generateRandomId(),
        userId: workflow.userId,
        workflowId,
        formId,
        connectionId,
        lastResponseId: latestResponseId,
        lastCheckedAt: new Date(),
        active: true,
      },
    });
  }

  // ============================================================================
  // STEP 3: Update workflow status
  // ============================================================================

  // UX guardrail: Check Gmail nodes have gmail.send scope before activation
  try {
    const gmailNodes = (definition.nodes || []).filter((n: any) =>
      typeof n.type === "string" && n.type.includes("gmail.action.sendEmail")
    );
    for (const node of gmailNodes) {
      const connId = node.config?.connectionId;
      if (!connId) {
        throw new WorkflowActivationError("Gmail node requires connectionId in config", { node });
      }
      const conn = await prisma.connection.findUnique({ where: { id: connId } });
      const granted = (conn?.metadata as any)?.scope as string | undefined;
      const gmailScope = "https://www.googleapis.com/auth/gmail.send";
      if (!conn || !connectionHasScopes(granted, [gmailScope])) {
        throw new WorkflowActivationError(
          "Reconnect Google with Gmail permissions before activating",
          { requiredScopes: [gmailScope] }
        );
      }
    }
  } catch (e) {
    if (e instanceof WorkflowActivationError) throw e;
    throw new WorkflowActivationError(
      e instanceof Error ? e.message : String(e)
    );
  }

  await prisma.workflow.update({
    where: { id: workflowId },
    data: { status: "ACTIVE" },
  });

  const webhookUrl = subscription
    ? `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/webhooks/${subscription.webhookPath}`
    : undefined;

  console.log(`[Activation] Workflow activated: ${workflowId}`);
  if (webhookUrl) console.log(`[Activation] Webhook URL: ${webhookUrl}`);

  return {
    workflowId,
    status: "ACTIVE",
    webhookUrl,
    message: triggerType === "webhook"
      ? "Workflow activated successfully with webhook trigger"
      : "Workflow activated successfully with Google Forms trigger",
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

  // Also disable Google Forms polling trigger if present
  await prisma.googleFormsTrigger.updateMany({
    where: { workflowId },
    data: { active: false, lastCheckedAt: new Date() },
  });

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
