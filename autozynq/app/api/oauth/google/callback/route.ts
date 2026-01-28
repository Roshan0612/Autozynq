import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";

function getClientId(): string {
  const id = process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.GOOGLE_ID;
  if (!id) throw new Error("Missing GOOGLE_OAUTH_CLIENT_ID (or GOOGLE_ID)");
  return id;
}

function getClientSecret(): string {
  const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || process.env.GOOGLE_SECRET;
  if (!secret) throw new Error("Missing GOOGLE_OAUTH_CLIENT_SECRET (or GOOGLE_SECRET)");
  return secret;
}

function getRedirectUri(origin: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || origin;
  return `${base}/api/oauth/google/callback`;
}

async function fetchTokens(code: string, redirectUri: string) {
  const body = new URLSearchParams({
    code,
    client_id: getClientId(),
    client_secret: getClientSecret(),
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    id_token?: string;
    scope?: string;
    token_type?: string;
  }>;
}

async function fetchProfile(accessToken: string) {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch Google profile: ${res.status} ${text}`);
  }

  return res.json() as Promise<{
    id?: string;
    email?: string;
    name?: string;
    picture?: string;
  }>;
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");

  if (!code || !stateParam) {
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
  }

  let state: { userId?: string; returnUrl?: string } = {};
  try {
    state = JSON.parse(Buffer.from(stateParam, "base64url").toString("utf8"));
  } catch {
    return NextResponse.json({ error: "Invalid state" }, { status: 400 });
  }

  const session = (await getServerSession(authOptions)) as { user?: { id?: string; email?: string } } | null;
  const sessionUserId = session?.user?.id as string | undefined;
  if (!sessionUserId || sessionUserId !== state.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const redirectUri = getRedirectUri(url.origin);

  try {
    const token = await fetchTokens(code, redirectUri);
    console.log("Token response:", { 
      access_token: token.access_token ? `${token.access_token.substring(0, 20)}...` : "MISSING",
      refresh_token: token.refresh_token ? "present" : "missing",
      expires_in: token.expires_in,
      scope: token.scope,
      token_type: token.token_type,
    });

    const profile = await fetchProfile(token.access_token);

    const expiresAt = token.expires_in
      ? new Date(Date.now() + token.expires_in * 1000)
      : null;

    // Allow multiple Google connections per user by creating a new record each time
    await prisma.connection.create({
      data: {
        userId: sessionUserId,
        provider: "google",
        accessToken: token.access_token,
        refreshToken: token.refresh_token || null,
        expiresAt: expiresAt || undefined,
        metadata: {
          email: profile.email,
          name: profile.name,
          picture: profile.picture,
          googleUserId: profile.id,
          // Store scopes under both keys for backward compatibility
          scope: token.scope,
          scopes: token.scope,
        },
      },
    });
  } catch (error: unknown) {
    console.error("OAuth callback error:", error);
    const errorMessage = error instanceof Error ? error.message : "OAuth failed";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }

  const returnUrl = state.returnUrl || "/";
  return NextResponse.redirect(returnUrl);
}

