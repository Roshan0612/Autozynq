/* eslint-disable @typescript-eslint/no-unused-vars */
import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { OAuthExpiredError } from "@/lib/errors";

/**
 * Create an OAuth2 client for a Connection and ensure fresh tokens.
 * Automatically refreshes the access token if expired and persists updates.
 */
export async function getGoogleOAuthClient(connectionId: string) {
  const connection = await prisma.connection.findUnique({ where: { id: connectionId } });
  if (!connection) throw new Error(`Connection not found: ${connectionId}`);
  if (connection.provider !== "google") throw new Error(`Connection is not Google: ${connectionId}`);

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/oauth/google/callback`
  );

  oauth2Client.setCredentials({
    access_token: connection.accessToken,
    refresh_token: connection.refreshToken || undefined,
    expiry_date: connection.expiresAt ? connection.expiresAt.getTime() : undefined,
  });

  // If expired or missing, refresh the token using the refresh_token
  const now = Date.now();
  const isExpired = !connection.expiresAt || connection.expiresAt.getTime() - now < 60_000; // less than 1 min left
  if (isExpired && connection.refreshToken) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      const newExpiresAt = credentials.expiry_date ? new Date(credentials.expiry_date) : null;

      await prisma.connection.update({
        where: { id: connectionId },
        data: {
          accessToken: credentials.access_token || connection.accessToken,
          expiresAt: newExpiresAt || connection.expiresAt || undefined,
          metadata: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...(connection.metadata as any) || {},
            needsReauth: false,
          },
        },
      });

      oauth2Client.setCredentials({
        access_token: credentials.access_token || connection.accessToken,
        refresh_token: connection.refreshToken || undefined,
        expiry_date: credentials.expiry_date,
      });
    } catch (err) {
      // Mark connection as requiring re-auth
      await prisma.connection.update({
        where: { id: connectionId },
        data: {
          metadata: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...(connection.metadata as any) || {},
            needsReauth: true,
          },
        },
      });
      throw new OAuthExpiredError("Failed to refresh Google access token. Please reconnect.");
    }
  }

  return oauth2Client;
}

export function connectionHasScopes(scopeString: string | null | undefined, required: string[]): boolean {
  if (!scopeString) return false;
  const granted = new Set(scopeString.split(" ").filter(Boolean));
  return required.every((s) => granted.has(s));
}

