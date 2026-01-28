import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/executions/[id]
 * 
 * Get detailed execution information including all steps.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const session = (await getServerSession(authOptions)) as { user?: { id?: string; email?: string } } | null;
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const executionId = id;

    // Fetch execution with workflow
    const execution = await prisma.execution.findUnique({
      where: { id: executionId },
      include: {
        workflow: {
          select: {
            id: true,
            name: true,
            status: true,
            userId: true,
            definition: true,
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
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user || execution.workflow.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ execution });
  } catch (error) {
    console.error("Failed to fetch execution:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch execution",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
