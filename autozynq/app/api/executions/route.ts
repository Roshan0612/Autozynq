import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/executions
 * 
 * List all executions for the authenticated user.
 * Includes workflow name for display.
 */
export async function GET(req: NextRequest) {
  try {
    // Authenticate user
    const session = (await getServerSession(authOptions)) as { user?: { id?: string; email?: string } } | null;
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

    // Parse query params
    const searchParams = req.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "50");
    const status = searchParams.get("status");
    const workflowId = searchParams.get("workflowId");

    // Build where clause
    const where: Record<string, unknown> = {
      workflow: {
        userId: user.id,
      },
    };

    if (status) {
      where.status = status;
    }

    if (workflowId) {
      where.workflowId = workflowId;
    }

    // Fetch executions
    const executions = await prisma.execution.findMany({
      where,
      include: {
        workflow: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
      orderBy: { startedAt: "desc" },
      take: limit,
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

