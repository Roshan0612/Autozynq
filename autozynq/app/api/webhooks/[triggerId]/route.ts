import { NextRequest, NextResponse } from "next/server";
import {
  getTriggerSubscriptionByPath,
  updateSubscriptionAfterExecution,
} from "@/lib/triggers/subscriptions";
import { runWorkflow } from "@/lib/execution";

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
 * 3. Look up trigger subscription
 * 4. Validate workflow is ACTIVE
 * 5. Call runWorkflow() to start execution
 * 6. Update subscription metadata
 * 7. Return 200 with execution ID
 * 
 * Design:
 * - No authentication required (webhooks are public)
 * - Minimal validation (payload must be object)
 * - Defensive error handling (never crashes)
 * - All errors logged but gracefully returned
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ triggerId: string }> }
) {
  const startTime = Date.now();

  try {
    // ============================================================================
    // STEP 1: Extract trigger ID (webhook path) from URL
    // ============================================================================

    const { triggerId } = await params;

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
    try {
      webhookPayload = await req.json();
    } catch {
      // Allow empty body
      webhookPayload = {};
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

    console.log(`[Webhook] Received event for trigger: ${triggerId}`);
    console.log(
      `[Webhook] Payload: ${JSON.stringify(webhookPayload).substring(0, 200)}...`
    );

    // ============================================================================
    // STEP 3: Look up trigger subscription by webhook path
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
    // STEP 5: Call runWorkflow to start execution
    // ============================================================================

    let executionId: string;
    try {
      const execution = await runWorkflow({
        workflowId: subscription.workflowId,
        userId: subscription.workflow.userId,
        triggerInput: webhookPayload,
      });

      executionId = execution.id;

      console.log(
        `[Webhook] Execution started: ${executionId} for workflow: ${subscription.workflowId}`
      );
    } catch (error) {
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
    // STEP 6: Update subscription with execution data
    // ============================================================================

    try {
      await updateSubscriptionAfterExecution(subscription.id, webhookPayload);
    } catch (error) {
      // Log but don't fail - execution already started
      console.warn(`[Webhook] Failed to update subscription:`, error);
    }

    // ============================================================================
    // STEP 7: Return success response
    // ============================================================================

    const duration = Date.now() - startTime;

    console.log(
      `[Webhook] Success: execution ${executionId} started in ${duration}ms`
    );

    return NextResponse.json(
      {
        success: true,
        triggerId,
        workflowId: subscription.workflowId,
        executionId,
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
