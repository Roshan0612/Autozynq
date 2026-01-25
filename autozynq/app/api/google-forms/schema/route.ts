import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getFormSchema } from "@/lib/nodes/google_forms/service";

/**
 * GET /api/google-forms/schema?connectionId=<id>&formId=<id>
 * 
 * Get the schema (questions) for a Google Form
 * Requires: NextAuth session + valid Google connection ID + Form ID
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connectionId = req.nextUrl.searchParams.get("connectionId");
  const formId = req.nextUrl.searchParams.get("formId");

  if (!connectionId || !formId) {
    return NextResponse.json(
      { error: "Missing connectionId or formId" },
      { status: 400 }
    );
  }

  try {
    const schema = await getFormSchema(connectionId, formId);
    return NextResponse.json(schema);
  } catch (error) {
    console.error("Error getting form schema:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get form schema" },
      { status: 500 }
    );
  }
}
