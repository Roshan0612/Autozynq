import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";
import { generateRandomId } from "@/lib/utils";
import { getLatestResponseId } from "@/lib/integrations/google/forms";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null) as any;
  const { workflowId, formId, connectionId } = body || {};
  if (!workflowId || !formId) {
    return NextResponse.json({ error: "Missing workflowId or formId" }, { status: 400 });
  }

  // Use provided connectionId or user's latest Google connection
  let connId = connectionId as string | undefined;
  if (!connId) {
    const conn = await prisma.connection.findFirst({ where: { userId, provider: "google" }, orderBy: { createdAt: "desc" } });
    if (!conn) return NextResponse.json({ error: "No Google connection" }, { status: 400 });
    connId = conn.id;
  }

  const triggerId = generateRandomId();
  const latestResponseId = await getLatestResponseId(connId!, formId);

  const trigger = await prisma.googleFormsTrigger.create({
    data: {
      triggerId,
      userId,
      workflowId,
      formId,
      connectionId: connId!,
      lastResponseId: latestResponseId,
      lastCheckedAt: new Date(),
      active: true,
    },
  });

  return NextResponse.json({ id: trigger.id, triggerId: trigger.triggerId });
}
