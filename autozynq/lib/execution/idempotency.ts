import crypto from "crypto";
import { prisma } from "../prisma";
import { runWorkflow, RunWorkflowParams } from "./engine";

/**
 * Idempotency Utility for Execution Control
 * 
 * Prevents duplicate executions from:
 * - Webhook retries
 * - Network duplication
 * - Manual replays
 * 
 * Strategy:
 * - Compute idempotency key from workflow context and trigger data
 * - Check if execution already exists with same key
 * - If exists, return existing execution ID
 * - If not, create new execution
 * 
 * This is a thin control layer, NOT part of the engine.
 */

export interface IdempotentExecutionParams extends RunWorkflowParams {
  /**
   * Components used to compute idempotency key.
   * If not provided, idempotency is not enforced.
   */
  idempotency?: {
    /**
     * Unique event ID from external system (e.g., Stripe event ID).
     * Preferred over payload hash when available.
     */
    eventId?: string;

    /**
     * Trigger node ID (for multi-trigger workflows).
     */
    nodeId: string;

    /**
     * Webhook path or identifier (for webhooks).
     */
    webhookPath?: string;
  };
}

export interface IdempotentExecutionResult {
  /**
   * Execution ID (new or existing).
   */
  executionId: string;

  /**
   * Whether this is a new execution or a duplicate.
   */
  isDuplicate: boolean;

  /**
   * The idempotency key used (if any).
   */
  idempotencyKey?: string;
}

/**
 * Run workflow with idempotency protection.
 * 
 * If idempotency params are provided:
 * 1. Compute idempotency key
 * 2. Check for existing execution
 * 3. If exists, return existing execution ID
 * 4. If not, create new execution with key
 * 
 * If no idempotency params, runs normally.
 * 
 * @param params - Execution parameters with optional idempotency
 * @returns Execution result with duplicate flag
 */
export async function runWorkflowIdempotent(
  params: IdempotentExecutionParams
): Promise<IdempotentExecutionResult> {
  const { idempotency, ...runParams } = params;

  // If no idempotency params, run normally
  if (!idempotency) {
    const executionId = await runWorkflow(runParams);
    return {
      executionId,
      isDuplicate: false,
    };
  }

  // ============================================================================
  // STEP 1: Compute idempotency key
  // ============================================================================

  const idempotencyKey = computeIdempotencyKey({
    workflowId: params.workflowId,
    nodeId: idempotency.nodeId,
    webhookPath: idempotency.webhookPath,
    eventId: idempotency.eventId,
    payload: params.triggerInput,
  });

  console.log(
    `[Idempotency] Computed key: ${idempotencyKey} for workflow: ${params.workflowId}`
  );

  // ============================================================================
  // STEP 2: Check for existing execution with same key
  // ============================================================================

  const existingExecution = await prisma.execution.findUnique({
    where: { idempotencyKey },
    select: {
      id: true,
      status: true,
      startedAt: true,
    },
  });

  if (existingExecution) {
    console.log(
      `[Idempotency] Duplicate detected. Returning existing execution: ${existingExecution.id} ` +
      `(status: ${existingExecution.status}, started: ${existingExecution.startedAt})`
    );

    return {
      executionId: existingExecution.id,
      isDuplicate: true,
      idempotencyKey,
    };
  }

  // ============================================================================
  // STEP 3: Create new execution with idempotency key
  // ============================================================================

  const executionId = await runWorkflow({
    ...runParams,
    idempotencyKey,
  });

  console.log(
    `[Idempotency] New execution created: ${executionId} with key: ${idempotencyKey}`
  );

  return {
    executionId,
    isDuplicate: false,
    idempotencyKey,
  };
}

/**
 * Compute idempotency key from execution context.
 * 
 * Strategy:
 * - Use eventId if provided (most reliable)
 * - Otherwise hash payload + context
 * 
 * Format: {workflowId}:{nodeId}:{webhookPath}:{eventId|hash}
 * 
 * @param params - Components for key computation
 * @returns Idempotency key string
 */
function computeIdempotencyKey(params: {
  workflowId: string;
  nodeId: string;
  webhookPath?: string;
  eventId?: string;
  payload?: unknown;
}): string {
  const { workflowId, nodeId, webhookPath, eventId, payload } = params;

  // Base components
  const parts = [workflowId, nodeId];

  if (webhookPath) {
    parts.push(webhookPath);
  }

  // Use eventId if provided, otherwise hash payload
  if (eventId) {
    parts.push(eventId);
  } else {
    const payloadHash = hashPayload(payload);
    parts.push(payloadHash);
  }

  return parts.join(":");
}

/**
 * Hash payload for idempotency key.
 * 
 * Uses SHA-256 to create deterministic hash.
 * Handles JSON serialization consistently.
 * 
 * @param payload - Trigger input payload
 * @returns Hash string (first 16 chars of SHA-256)
 */
function hashPayload(payload: unknown): string {
  const json = JSON.stringify(payload || {});
  const hash = crypto.createHash("sha256").update(json).digest("hex");
  return hash.substring(0, 16); // Use first 16 chars for readability
}
