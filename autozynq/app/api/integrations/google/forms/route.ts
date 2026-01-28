import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { listUserForms } from "@/lib/integrations/google/forms";
import { OAuthScopeError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  const session = (await getServerSession(authOptions)) as { user?: { id?: string; email?: string } } | null;
  const userId = session?.user?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const connectionId = req.nextUrl.searchParams.get("connectionId") || undefined;
  try {
    const forms = await listUserForms(userId, connectionId);
    return NextResponse.json(forms);
  } catch (err: unknown) {
    if (err instanceof OAuthScopeError) {
      return NextResponse.json(
        {
          error: "INSUFFICIENT_GOOGLE_SCOPES",
          requiredScopes: (err.requiredScopes || []).map((s) =>
            s.includes("drive") ? "drive" : s.includes("forms") ? "forms" : s
          ),
          action: "RECONNECT_GOOGLE",
          message: err.message,
        },
        { status: 403 }
      );
    }
    // Generic mapping: never leak raw Google errors
    return NextResponse.json({ error: "FAILED_TO_LIST_FORMS" }, { status: 500 });
  }
}

