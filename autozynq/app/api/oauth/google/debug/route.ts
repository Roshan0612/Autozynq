import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.GOOGLE_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || req.nextUrl.origin}/api/oauth/google/callback`;

  return NextResponse.json({
    clientId: clientId ? `${clientId.substring(0, 20)}...` : "MISSING",
    redirectUri,
    appUrl: process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "NOT SET",
    nextAuthUrl: process.env.NEXTAUTH_URL,
    timestamp: new Date().toISOString(),
  });
}
