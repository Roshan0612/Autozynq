import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  getTriggerSubscriptionByPath,
  updateSubscriptionAfterExecution,
} from "@/lib/triggers/subscriptions";
import { runWorkflowIdempotent } from "@/lib/execution/idempotency";
import { WorkflowLockedError, LockAcquisitionFailedError } from "@/lib/execution/lock";

/**
 * POST /api/webhooks/[triggerId]
 * 
 * Webhook Trigger Endpoint
 * 
 * Receives HTTP events from external systems and starts workflow execution.
 * Acts as a bridge between external services and the execution engine.
 * 
 * Flow:
 * 1. Extract trigger webhook path from URL
 * 2. Parse request body as JSON
 * 3. Verify webhook signature (for Google Forms)
 * 4. Look up trigger subscription
 * 5. Validate workflow is ACTIVE
 * 6. Call runWorkflow() to start execution
 * 7. Update subscription metadata
 * 8. Return 200 with execution ID
 * 
 * Design:
 * - No authentication required (webhooks are public)
 * - Minimal validation (payload must be object)
 * - Defensive error handling (never crashes)
 * - All errors logged but gracefully returned
 */

/**
 * Verify webhook signature from Google Forms
 * Uses HMAC SHA256 with shared secret
 */
function verifySignature(payload: string, signature: string): boolean {
  const secret = process.env.GOOGLE_FORMS_WEBHOOK_SECRET || "secret";
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ triggerId: string }> }
) {
  const startTime = Date.now();
  let triggerId: string | undefined;

  try {
    // ============================================================================
    // STEP 1: Extract trigger ID (webhook path) from URL
    // ============================================================================

    const paramsData = await params;
    triggerId = paramsData.triggerId;

    if (!triggerId) {
      return NextResponse.json(
        { error: "Trigger ID is required" },
        { status: 400 }
      );
    }

    // ============================================================================
    // STEP 2: Parse webhook payload (JSON)
    // ============================================================================

    let webhookPayload: unknown;
    let rawPayload: string;
    try {
      rawPayload = await req.text();
      webhookPayload = JSON.parse(rawPayload);
    } catch {
      // Allow empty body
      webhookPayload = {};
      rawPayload = "{}";
    }

    // Validate payload is an object
    if (typeof webhookPayload !== "object" || webhookPayload === null) {
      return NextResponse.json(
        {
          error: "Invalid payload: must be a JSON object",
          triggerId,
        },
        { status: 400 }
      );
    }

    // ============================================================================
    // STEP 3: Verify webhook signature (for Google Forms)
    // ============================================================================

    const signature = req.headers.get("X-Signature");
    if (signature) {
      try {
        if (!verifySignature(rawPayload, signature)) {
          console.warn(`[Webhook] Signature verification failed for trigger: ${triggerId}`);
          return NextResponse.json(
            { error: "Signature verification failed" },
            { status: 401 }
          );
        }
        console.log(`[Webhook] Signature verified for trigger: ${triggerId}`);
      } catch (error) {
        console.warn(`[Webhook] Signature verification error: ${error}`);
        // Continue without signature verification if something fails
      }
    }

    console.log(`[Webhook] Received event for trigger: ${triggerId}`);
    console.log(
      `[Webhook] Payload: ${JSON.stringify(webhookPayload).substring(0, 200)}...`
    );

    // ============================================================================
    // STEP 4: Look up trigger subscription by webhook path
    // ============================================================================

    const subscription = await getTriggerSubscriptionByPath(triggerId);

    if (!subscription) {
      console.warn(`[Webhook] Trigger not found: ${triggerId}`);
      return NextResponse.json(
        { error: "Trigger not found", triggerId },
        { status: 404 }
      );
    }

    console.log(
      `[Webhook] Found subscription: ${subscription.id} for workflow: ${subscription.workflowId}`
    );

    // ============================================================================
    // STEP 4: Validate workflow is ACTIVE
    // ============================================================================

    if (subscription.workflow.status !== "ACTIVE") {
      console.warn(
        `[Webhook] Workflow not active: ${subscription.workflowId} (status: ${subscription.workflow.status})`
      );
      return NextResponse.json(
        {
          error: "Workflow is not active",
          triggerId,
          workflowId: subscription.workflowId,
          status: subscription.workflow.status,
        },
        { status: 400 }
      );
    }

    // ============================================================================
    // STEP 5: Call runWorkflow with idempotency to start execution
    // ============================================================================

    let executionId: string;
    let isDuplicate = false;
    let lockedByExecution: string | undefined;
    
    try {
      // Extract eventId from payload if available (common pattern in webhooks)
      const eventId = 
        typeof webhookPayload === "object" && webhookPayload !== null && "id" in webhookPayload
          ? String((webhookPayload as Record<string, unknown>).id)
          : undefined;

      const result = await runWorkflowIdempotent({
        workflowId: subscription.workflowId,
        userId: subscription.workflow.userId,
        triggerInput: webhookPayload,
        idempotency: {
          nodeId: subscription.nodeId,
          webhookPath: subscription.webhookPath,
          eventId,
        },
      });

      executionId = result.executionId;
      isDuplicate = result.isDuplicate;

      if (isDuplicate) {
        console.log(
          `[Webhook] Duplicate event detected. Returning existing execution: ${executionId}`
        );
      } else {
        console.log(
          `[Webhook] Execution started: ${executionId} for workflow: ${subscription.workflowId}`
        );
      }
    } catch (error) {
      // Handle specific lock errors
      if (error instanceof WorkflowLockedError) {
        lockedByExecution = error.existingExecutionId;

        console.warn(
          `[Webhook] Workflow locked by concurrent execution: ${lockedByExecution}`
        );

        const duration = Date.now() - startTime;

        return NextResponse.json(
          {
            success: false,
            error: "Workflow currently executing",
            details: `Only one execution can run at a time. Currently executing: ${lockedByExecution}`,
            triggerId,
            workflowId: subscription.workflowId,
            existingExecutionId: lockedByExecution,
            duration: `${duration}ms`,
          },
          { status: 409 } // Conflict status
        );
      }

      if (error instanceof LockAcquisitionFailedError) {
        console.warn(`[Webhook] Lock acquisition failed (concurrent request won)`);

        const duration = Date.now() - startTime;

        return NextResponse.json(
          {
            success: false,
            error: "Concurrent execution attempted",
            details: "Another concurrent request acquired the execution lock",
            triggerId,
            workflowId: subscription.workflowId,
            duration: `${duration}ms`,
          },
          { status: 409 } // Conflict status
        );
      }

      // Other errors
      console.error(`[Webhook] Failed to start execution:`, error);
      return NextResponse.json(
        {
          error: "Failed to start execution",
          triggerId,
          workflowId: subscription.workflowId,
          details: error instanceof Error ? error.message : String(error),
        },
        { status: 500 }
      );
    }

    // ============================================================================
    // STEP 6: Update subscription with execution data (skip if duplicate)
    // ============================================================================

    if (!isDuplicate) {
      try {
        await updateSubscriptionAfterExecution(subscription.id, webhookPayload);
      } catch (error) {
        // Log but don't fail - execution already started
        console.warn(`[Webhook] Failed to update subscription:`, error);
      }
    }

    // ============================================================================
    // STEP 7: Return success response
    // ============================================================================

    const duration = Date.now() - startTime;

    console.log(
      `[Webhook] Success: execution ${executionId} ${isDuplicate ? "(duplicate) " : ""}returned in ${duration}ms`
    );

    return NextResponse.json(
      {
        success: true,
        triggerId,
        workflowId: subscription.workflowId,
        executionId,
        isDuplicate,
        duration: `${duration}ms`,
      },
      { status: 200 }
    );
  } catch (error) {
    // ============================================================================
    // ERROR HANDLING
    // ============================================================================

    console.error(`[Webhook] Error processing webhook:`, error);

    const duration = Date.now() - startTime;

    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
        triggerId,
        duration: `${duration}ms`,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/[triggerId]
 * 
 * Returns trigger subscription information for debugging.
 * No authentication required.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ triggerId: string }> }
) {
  try {
    const { triggerId } = await params;

    if (!triggerId) {
      return NextResponse.json(
        { error: "Trigger ID is required" },
        { status: 400 }
      );
    }

    const subscription = await getTriggerSubscriptionByPath(triggerId);

    if (!subscription) {
      return NextResponse.json(
        { error: "Trigger not found", triggerId },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: subscription.id,
      workflowId: subscription.workflowId,
      nodeId: subscription.nodeId,
      triggerType: subscription.triggerType,
      webhookPath: subscription.webhookPath,
      webhookUrl: `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/webhooks/${subscription.webhookPath}`,
      executionCount: subscription.executionCount,
      lastPayload: subscription.lastPayload,
      workflowStatus: subscription.workflow.status,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
    });
  } catch (error) {
    console.error(`[Webhook] GET error:`, error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
