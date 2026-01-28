/**
 * Trigger Subscription Service
 * 
 * Handles creation, lookup, and management of webhook trigger subscriptions.
 * This is the bridge between HTTP webhooks and workflow execution.
 */

import { prisma } from "@/lib/prisma";
import { generateRandomId } from "@/lib/utils";

interface CreateSubscriptionInput {
  workflowId: string;
  nodeId: string;
  triggerType: string; // "webhook"
}

/**
 * Create a trigger subscription for a workflow's trigger node
 * 
 * This is called when a workflow is activated and has a trigger node.
 * Generates a unique webhookPath that can be shared publicly.
 */
export async function createTriggerSubscription(
  input: CreateSubscriptionInput
) {
  const { workflowId, nodeId, triggerType } = input;

  // Generate unique webhook path (random ID)
  const webhookPath = generateRandomId();

  const subscription = await prisma.triggerSubscription.create({
    data: {
      workflowId,
      nodeId,
      triggerType,
      webhookPath,
    },
  });

  return subscription;
}

/**
 * Look up a trigger subscription by webhook path
 * 
 * This is called when a webhook is received. Returns the subscription
 * with workflow details so we can start execution.
 */
export async function getTriggerSubscriptionByPath(webhookPath: string) {
  const subscription = await prisma.triggerSubscription.findUnique({
    where: { webhookPath },
    include: {
      workflow: {
        select: {
          id: true,
          name: true,
          userId: true,
          status: true,
          definition: true,
        },
      },
    },
  });

  return subscription;
}

/**
 * Update subscription after successful execution
 * 
 * Stores the last payload and increments execution count
 */
export async function updateSubscriptionAfterExecution(
  subscriptionId: string,
  payload: unknown
) {
  return await prisma.triggerSubscription.update({
    where: { id: subscriptionId },
    data: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lastPayload: payload as any,
      executionCount: {
        increment: 1,
      },
    },
  });
}

/**
 * Delete trigger subscription (e.g., when workflow is deactivated)
 */
export async function deleteTriggerSubscription(subscriptionId: string) {
  return await prisma.triggerSubscription.delete({
    where: { id: subscriptionId },
  });
}

/**
 * Get all subscriptions for a workflow
 */
export async function getWorkflowSubscriptions(workflowId: string) {
  return await prisma.triggerSubscription.findMany({
    where: { workflowId },
    orderBy: { createdAt: "desc" },
  });
}
