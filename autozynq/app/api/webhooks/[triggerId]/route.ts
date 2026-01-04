import { NextRequest, NextResponse } from "next/server";
import { getTriggerById, validateTriggerActive, TriggerValidationError } from "@/lib/triggers";
import { runWorkflow } from "@/lib/execution";
import { TriggerExecutionInput } from "@/lib/triggers/types";

/**
 * POST /api/webhooks/[triggerId]
 * 
 * Webhook Trigger Endpoint
 * 
 * This endpoint receives external HTTP events and starts workflow execution.
 * It acts as a bridge between external services and the execution engine.
 * 
 * Flow:
 * 1. Extract triggerId from URL
 * 2. Parse and validate request body
 * 3. Look up trigger metadata from database
 * 4. Validate trigger is active
 * 5. Prepare execution input with trigger data
 * 6. Call runWorkflow() to start execution
 * 7. Return HTTP 200 immediately
 * 
 * Design Principles:
 * - No workflow logic in this route (separation of concerns)
 * - Trigger service handles all validation
 * - Execution engine handles all workflow execution
 * - This route is just a thin bridge layer
 * 
 * @param req - Next.js request object
 * @param params - Route parameters { triggerId }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ triggerId: string }> }
) {
  const startTime = Date.now();

  try {
    // ============================================================================
    // STEP 1: Extract trigger ID from URL
    // ============================================================================

    const { triggerId } = await params;

    if (!triggerId) {
      return NextResponse.json(
        { error: "Trigger ID is required" },
        { status: 400 }
      );
    }

    // ============================================================================
    // STEP 2: Parse request body (webhook payload)
    // ============================================================================

    let webhookPayload: unknown;
    try {
      webhookPayload = await req.json();
    } catch {
      // If body is not JSON, use empty object
      webhookPayload = {};
    }

    // Extract metadata from request
    const metadata = {
      triggerId,
      triggerType: "WEBHOOK" as const,
      timestamp: new Date().toISOString(),
      source: {
        ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
        userAgent: req.headers.get("user-agent") || "unknown",
        method: req.method,
        url: req.url,
      },
    };

    console.log(`[Webhook] Received event for trigger: ${triggerId}`);
    console.log(`[Webhook] Payload:`, JSON.stringify(webhookPayload, null, 2));

    // ============================================================================
    // STEP 3: Look up trigger metadata from database
    // ============================================================================

    const trigger = await getTriggerById(triggerId);

    if (!trigger) {
      console.warn(`[Webhook] Trigger not found: ${triggerId}`);
      return NextResponse.json(
        { error: "Trigger not found" },
        { status: 404 }
      );
    }

    // ============================================================================
    // STEP 4: Validate trigger is active
    // ============================================================================

    try {
      await validateTriggerActive(trigger);
    } catch (error) {
      if (error instanceof TriggerValidationError) {
        console.warn(`[Webhook] Trigger validation failed:`, error.message);
        return NextResponse.json(
          {
            error: "Trigger is not active",
            details: error.details,
          },
          { status: 403 }
        );
      }
      throw error;
    }

    // ============================================================================
    // STEP 5: Prepare execution input
    // ============================================================================

    // Build trigger execution input with webhook payload
    const triggerInput: TriggerExecutionInput = {
      triggerNodeId: trigger.nodeId,
      triggerData: webhookPayload,
      metadata,
    };

    console.log(`[Webhook] Starting workflow execution:`, {
      workflowId: trigger.workflowId,
      nodeId: trigger.nodeId,
      triggerId: trigger.id,
    });

    // ============================================================================
    // STEP 6: Start workflow execution
    // ============================================================================

    // Execute workflow asynchronously
    // In production, this should be queued (BullMQ/Redis) but for now sync is fine
    const executionId = await runWorkflow({
      workflowId: trigger.workflowId,
      triggerInput: triggerInput.triggerData, // Pass webhook payload as trigger input
      userId: undefined, // Triggered by external event, not a user
    });

    // ============================================================================
    // STEP 7: Return success response
    // ============================================================================

    const executionTime = Date.now() - startTime;

    console.log(`[Webhook] Execution started successfully:`, {
      executionId,
      triggerId,
      executionTime: `${executionTime}ms`,
    });

    return NextResponse.json({
      success: true,
      executionId,
      triggerId,
      message: "Workflow execution started",
      executionTime: `${executionTime}ms`,
    });
  } catch (error) {
    // ============================================================================
    // ERROR HANDLING
    // ============================================================================

    console.error(`[Webhook] Error processing webhook:`, error);

    const executionTime = Date.now() - startTime;

    return NextResponse.json(
      {
        success: false,
        error: "Failed to process webhook",
        message: error instanceof Error ? error.message : String(error),
        executionTime: `${executionTime}ms`,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/[triggerId]
 * 
 * Get trigger information (for debugging/testing)
 * 
 * Returns trigger metadata without starting execution.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ triggerId: string }> }
) {
  try {
    const { triggerId } = await params;

    const trigger = await getTriggerById(triggerId);

    if (!trigger) {
      return NextResponse.json(
        { error: "Trigger not found" },
        { status: 404 }
      );
    }

    // Check if trigger is active
    let isValid = false;
    let validationError: string | undefined;

    try {
      await validateTriggerActive(trigger);
      isValid = true;
    } catch (error) {
      if (error instanceof TriggerValidationError) {
        validationError = error.message;
      }
    }

    return NextResponse.json({
      triggerId: trigger.id,
      workflowId: trigger.workflowId,
      nodeId: trigger.nodeId,
      type: trigger.type,
      isActive: trigger.isActive,
      isValid,
      validationError,
      createdAt: trigger.createdAt,
      updatedAt: trigger.updatedAt,
    });
  } catch (error) {
    console.error(`[Webhook] Error fetching trigger:`, error);

    return NextResponse.json(
      {
        error: "Failed to fetch trigger",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
