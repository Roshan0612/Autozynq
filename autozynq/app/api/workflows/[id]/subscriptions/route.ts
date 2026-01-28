import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/workflows/[id]/subscriptions
 * 
 * List all trigger subscriptions (webhooks) for a workflow
 * Returns the webhook paths that are active for this workflow
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = (await getServerSession(authOptions)) as { user?: { id?: string; email?: string } } | null;
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const workflowId = id;

    // Verify user owns this workflow
    const workflow = await prisma.workflow.findFirst({
      where: {
        id: workflowId,
        user: { email: session.user.email },
      },
    });

    if (!workflow) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }

    // Get all subscriptions for this workflow
    const subscriptions = await prisma.triggerSubscription.findMany({
      where: { workflowId },
      select: {
        id: true,
        workflowId: true,
        nodeId: true,
        triggerType: true,
        webhookPath: true,
        executionCount: true,
        createdAt: true,
        lastPayload: true,
      },
    });

    // Build webhook URLs
    const withUrls = subscriptions.map((sub) => ({
      ...sub,
      webhookUrl: `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/webhooks/${sub.webhookPath}`,
    }));

    return NextResponse.json({
      workflowId,
      count: subscriptions.length,
      subscriptions: withUrls,
    });
  } catch (error) {
    console.error("Failed to get subscriptions:", error);
    return NextResponse.json(
      {
        error: "Failed to get subscriptions",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
