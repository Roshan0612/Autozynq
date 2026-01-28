import { Prisma, WorkflowStatus } from "@prisma/client";
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

function normalizeStatus(input: unknown): WorkflowStatus | null {
  if (typeof input !== "string") return null;
  const candidate = input as WorkflowStatus;
  return Object.values(WorkflowStatus).includes(candidate) ? candidate : null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (!userId) {
    return unauthorizedResponse;
  }

  const { id } = await params;

  const workflow = await prisma.workflow.findFirst({
    where: { id, userId },
  });

  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  return NextResponse.json({ workflow });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (!userId) {
    return unauthorizedResponse;
  }

  const { id } = await params;

  const workflow = await prisma.workflow.findFirst({
    where: { id, userId },
  });

  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const payload = body as { name?: string; definition?: unknown; status?: unknown };
  const updateData: Prisma.WorkflowUpdateInput = {};
  let nextDefinition: unknown = undefined;

  if (payload.name !== undefined) {
    if (typeof payload.name !== "string" || payload.name.trim().length === 0) {
      return NextResponse.json({ error: "name must be a non-empty string" }, { status: 400 });
    }
    updateData.name = payload.name.trim();
  }

  if (payload.definition !== undefined) {
    nextDefinition = payload.definition;
    try {
      updateData.definition = validateWorkflowDefinition(payload.definition);
    } catch (error) {
      const validationResponse = mapValidationError(error);
      if (validationResponse) return validationResponse;
      throw error;
    }
  }

  if (payload.status !== undefined) {
    const normalizedStatus = normalizeStatus(payload.status);
    if (!normalizedStatus) {
      return NextResponse.json({ error: "status is invalid" }, { status: 400 });
    }
    updateData.status = normalizedStatus;
  }

  const isActivating = updateData.status === WorkflowStatus.ACTIVE;
  if (isActivating) {
    // Activation requires a valid, fully connected definition.
    const definitionToValidate = nextDefinition ?? workflow.definition;
    try {
      updateData.definition = validateWorkflowDefinition(definitionToValidate);
    } catch (error) {
      const validationResponse = mapValidationError(error);
      if (validationResponse) return validationResponse;
      throw error;
    }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No updates supplied" }, { status: 400 });
  }

  try {
    const updatedWorkflow = await prisma.workflow.update({
      where: { id: workflow.id },
      data: updateData,
    });

    return NextResponse.json({ workflow: updatedWorkflow });
  } catch (error) {
    const validationResponse = mapValidationError(error);
    if (validationResponse) return validationResponse;

    
    console.error("Failed to update workflow", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
