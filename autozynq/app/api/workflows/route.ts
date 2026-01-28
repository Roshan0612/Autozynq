import { WorkflowStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";
import { validateWorkflowDefinition, WorkflowValidationError } from "@/lib/workflow/validate";

const unauthorizedResponse = NextResponse.json({ error: "Unauthorized" }, { status: 401 });

async function requireUserId() {
  const session = (await getServerSession(authOptions)) as { user?: { id?: string; email?: string } } | null;
  const userId = session?.user?.id as string | undefined;
  return userId ?? null;
}

function mapValidationError(error: unknown) {
  if (error instanceof WorkflowValidationError) {
    return NextResponse.json({ error: error.message, details: error.details }, { status: 400 });
  }
  return null;
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) {
    return unauthorizedResponse;
  }

  const workflows = await prisma.workflow.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ workflows });
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) {
    return unauthorizedResponse;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const payload = body as { name?: string; definition?: unknown };
  if (!payload.name || typeof payload.name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  if (payload.definition === undefined) {
    return NextResponse.json({ error: "definition is required" }, { status: 400 });
  }

  try {
    const definition = validateWorkflowDefinition(payload.definition);
    const workflow = await prisma.workflow.create({
      data: {
        name: payload.name.trim(),
        userId,
        status: WorkflowStatus.DRAFT,
        definition,
      },
    });

    return NextResponse.json({ workflow }, { status: 201 });
  } catch (error) {
    const validationResponse = mapValidationError(error);
    if (validationResponse) return validationResponse;

    console.error("Failed to create workflow", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

