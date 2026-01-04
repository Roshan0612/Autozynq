import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/executions/:id/cancel
 * 
 * Cancel a running execution.
 * 
 * Behavior:
 * - Only allowed if execution status is RUNNING or PENDING
 * - Updates status to CANCEL_REQUESTED
 * - Stores abort metadata (abortedAt, abortedBy, reason)
 * - Does NOT stop the execution immediately
 * - Engine will detect the status change and abort gracefully
 * 
 * Design:
 * - This is a thin control layer, not execution logic
 * - The engine is responsible for checking status and aborting
 * - Returns immediately after state mutation
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ============================================================================
    // STEP 1: Authenticate user
    // ============================================================================

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // ============================================================================
    // STEP 2: Extract execution ID and optional reason
    // ============================================================================

    const { id: executionId } = await params;

    let body: { reason?: string } = {};
    try {
      body = await req.json();
    } catch {
      // No body provided, continue with defaults
    }

    const reason = body.reason || "Cancelled by user";

    // ============================================================================
    // STEP 3: Fetch execution and verify ownership
    // ============================================================================

    const execution = await prisma.execution.findUnique({
      where: { id: executionId },
      include: {
        workflow: {
          select: {
            userId: true,
            name: true,
          },
        },
      },
    });

    if (!execution) {
      return NextResponse.json(
        { error: "Execution not found" },
        { status: 404 }
      );
    }

    // Verify user owns the workflow
    if (execution.workflow.userId !== user.id) {
      return NextResponse.json(
        { error: "Forbidden: You do not own this execution" },
        { status: 403 }
      );
    }

    // ============================================================================
    // STEP 4: Validate execution can be cancelled
    // ============================================================================

    if (execution.status !== "RUNNING" && execution.status !== "PENDING") {
      return NextResponse.json(
        {
          error: "Cannot cancel execution",
          details: `Execution is in ${execution.status} state. Only RUNNING or PENDING executions can be cancelled.`,
          executionId,
          status: execution.status,
        },
        { status: 400 }
      );
    }

    // ============================================================================
    // STEP 5: Update execution to CANCEL_REQUESTED
    // ============================================================================

    const updatedExecution = await prisma.execution.update({
      where: { id: executionId },
      data: {
        status: "CANCEL_REQUESTED",
        abortedAt: new Date(),
        abortedBy: user.id,
        abortReason: reason,
      },
    });

    console.log(
      `[Cancel] Execution ${executionId} marked for cancellation by user ${user.id}`
    );

    // ============================================================================
    // STEP 6: Return success response
    // ============================================================================

    return NextResponse.json({
      success: true,
      executionId,
      status: updatedExecution.status,
      message: "Execution marked for cancellation. The engine will abort gracefully.",
      abortedAt: updatedExecution.abortedAt,
      abortedBy: updatedExecution.abortedBy,
      abortReason: updatedExecution.abortReason,
    });
  } catch (error) {
    console.error("Failed to cancel execution:", error);

    return NextResponse.json(
      {
        error: "Failed to cancel execution",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
