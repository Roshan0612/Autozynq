import { NextResponse, NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";

const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  // Forms: responses + body (schema)
  "https://www.googleapis.com/auth/forms.responses.readonly",
  "https://www.googleapis.com/auth/forms.body.readonly",
  // Drive: to discover forms in user's Drive
  "https://www.googleapis.com/auth/drive.readonly",
  // Gmail: send emails
  "https://www.googleapis.com/auth/gmail.send",
];

function getClientId(): string {
  const id = process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.GOOGLE_ID;
  if (!id) {
    throw new Error("Missing GOOGLE_OAUTH_CLIENT_ID (or GOOGLE_ID) env var");
  }
  return id;
}

function getRedirectUri(origin: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || origin;
  return `${base}/api/oauth/google/callback`;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id as string | undefined;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = getClientId();
  const redirectUri = getRedirectUri(req.nextUrl.origin);
  const returnUrl = req.nextUrl.searchParams.get("returnUrl") || "/";

  const statePayload = { userId, returnUrl };
  const state = Buffer.from(JSON.stringify(statePayload)).toString("base64url");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return NextResponse.redirect(authUrl);
}
