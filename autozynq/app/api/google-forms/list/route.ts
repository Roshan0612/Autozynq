import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { listForms } from "@/lib/nodes/google_forms/service";

/**
 * GET /api/google-forms/list?connectionId=<id>
 * 
 * List all Google Forms accessible to the user
 * Requires: NextAuth session + valid Google connection ID
 */
export async function GET(req: NextRequest) {
  const session = (await getServerSession(authOptions)) as { user?: { id?: string; email?: string } } | null;
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connectionId = req.nextUrl.searchParams.get("connectionId");
  if (!connectionId) {
    return NextResponse.json({ error: "Missing connectionId" }, { status: 400 });
  }

  try {
    const forms = await listForms(connectionId);
    return NextResponse.json(forms);
  } catch (error) {
    console.error("Error listing forms:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list forms" },
      { status: 500 }
    );
  }
}

