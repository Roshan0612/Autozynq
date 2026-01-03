import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import {
  activateWorkflow,
  deactivateWorkflow,
  toggleWorkflowStatus,
  WorkflowActivationError,
} from "@/lib/workflow/activation";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/workflows/[id]/activate
 * 
 * Activate a workflow and register its triggers.
 * 
 * This will:
 * 1. Validate workflow definition
 * 2. Set status to ACTIVE
 * 3. Register all trigger nodes
 * 4. Return webhook URLs for external services
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workflowId = params.id;

    // Verify workflow exists and user owns it
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: { user: true },
    });

    if (!workflow) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }

    if (workflow.user.email !== session.user.email) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Activate workflow
    const result = await activateWorkflow(workflowId, workflow.userId);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Workflow activation error:", error);

    if (error instanceof WorkflowActivationError) {
      return NextResponse.json(
        {
          error: "Activation failed",
          message: error.message,
          details: error.details,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to activate workflow",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workflows/[id]/activate
 * 
 * Deactivate a workflow and disable its triggers.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workflowId = params.id;

    // Verify workflow exists and user owns it
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: { user: true },
    });

    if (!workflow) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }

    if (workflow.user.email !== session.user.email) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Deactivate workflow
    const result = await deactivateWorkflow(workflowId, workflow.userId);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Workflow deactivation error:", error);

    return NextResponse.json(
      {
        error: "Failed to deactivate workflow",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
