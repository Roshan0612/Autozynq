import { WorkflowStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  // Authenticate user
  const session = (await getServerSession(authOptions)) as { user?: { id?: string } } | null;
  const userId = session?.user?.id as string | undefined;
  
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const payload = body as { name?: string };
  const name = payload.name?.trim() || "Untitled Workflow";

  try {
    // Create workflow with empty definition (no nodes, no edges)
    const workflow = await prisma.workflow.create({
      data: {
        name,
        userId,
        status: WorkflowStatus.DRAFT,
        definition: {
          nodes: [],
          edges: [],
          ui: { positions: {} },
        },
      },
    });

    return NextResponse.json({ workflow }, { status: 201 });
  } catch (error) {
    console.error("Failed to create empty workflow", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
