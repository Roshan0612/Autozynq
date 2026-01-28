import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { runWorkflow } from "@/lib/execution";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/workflows/[id]/execute
 * 
 * Execute an active workflow manually.
 * This endpoint demonstrates how to integrate the execution engine with Next.js API routes.
 * 
 * Body:
 * {
 *   triggerInput?: any // Optional trigger data override
 * }
 * 
 * Returns:
 * {
 *   executionId: string
 *   status: string
 * }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const session = (await getServerSession(authOptions)) as { user?: { id?: string; email?: string } } | null;
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id: workflowId } = await params;

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
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const { triggerInput, executionMode } = body as { triggerInput?: unknown; executionMode?: "live" | "test" };

    // Execute workflow
    const executionId = await runWorkflow({
      workflowId,
      userId: workflow.userId,
      triggerInput,
      executionMode: executionMode || "live",
    });

    // Fetch execution status
    const execution = await prisma.execution.findUnique({
      where: { id: executionId },
      select: {
        id: true,
        status: true,
        startedAt: true,
        finishedAt: true,
      },
    });

    return NextResponse.json({
      executionId,
      status: execution?.status,
      startedAt: execution?.startedAt,
      finishedAt: execution?.finishedAt,
    });
  } catch (error) {
    console.error("Workflow execution error:", error);
    // Fetch latest execution for status when runWorkflow handles errors gracefully
    const { id: workflowId } = await params;
    const latest = await prisma.execution.findFirst({
      where: { workflowId },
      orderBy: { startedAt: "desc" },
      select: { id: true, status: true, startedAt: true, finishedAt: true, error: true },
    });
    return NextResponse.json(
      {
        executionId: latest?.id,
        status: latest?.status || "FAILED",
        error: latest?.error || { message: "Workflow execution failed" },
        startedAt: latest?.startedAt,
        finishedAt: latest?.finishedAt,
      },
      { status: 200 }
    );
  }
}

/**
 * GET /api/workflows/[id]/execute
 * 
 * Get execution history for a workflow.
 * 
 * Query params:
 * - limit: number (default: 10)
 * - status: ExecutionStatus filter
 * 
 * Returns:
 * {
 *   executions: Execution[]
 * }
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const session = (await getServerSession(authOptions)) as { user?: { id?: string; email?: string } } | null;
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id: workflowId } = await params;

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
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // Parse query params
    const searchParams = req.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "10");
    const status = searchParams.get("status");

    // Fetch executions
    const executions = await prisma.execution.findMany({
      where: {
        workflowId,
        ...(status && { status: status as "PENDING" | "RUNNING" | "SUCCESS" | "FAILED" | "CANCEL_REQUESTED" | "ABORTED" }),
      },
      orderBy: { startedAt: "desc" },
      take: limit,
      select: {
        id: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        result: true,
        error: true,
      },
    });

    return NextResponse.json({ executions });
  } catch (error) {
    console.error("Failed to fetch executions:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch executions",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
