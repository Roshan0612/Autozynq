import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getGoogleOAuthClient } from "@/lib/integrations/google/auth";
import { connectionHasScopes } from "@/lib/integrations/google/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/integrations/google-sheets/sheets/[spreadsheetId]
 * Fetches sheet tabs/worksheets for a spreadsheet
 * Query params: connectionId
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ spreadsheetId: string }> }
) {
  try {
    const { searchParams } = new URL(req.url);
    const connectionId = searchParams.get("connectionId");
    const { spreadsheetId } = await params;

    if (!connectionId) {
      return NextResponse.json(
        { error: "connectionId is required" },
        { status: 400 }
      );
    }

    if (!spreadsheetId) {
      return NextResponse.json(
        { error: "spreadsheetId is required" },
        { status: 400 }
      );
    }

    console.log("[Google Sheets] Fetching sheets for:", { connectionId, spreadsheetId });

    // Validate connection and scopes
    const connection = await prisma.connection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      return NextResponse.json(
        { error: "Connection not found" },
        { status: 404 }
      );
    }

    if (connection.provider !== "google") {
      return NextResponse.json(
        { error: "Connection must be a Google account" },
        { status: 400 }
      );
    }

    const requiredScopes = [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.readonly",
    ];
    const metadata = connection.metadata as Record<string, unknown>;
    const scopeString = ((metadata?.scopes || metadata?.scope) as string | undefined);
    if (!connectionHasScopes(scopeString, requiredScopes)) {
      return NextResponse.json(
        {
          error: "Insufficient permissions",
          details: "Connection requires Google Sheets and Drive read scopes",
        },
        { status: 403 }
      );
    }

    // Get OAuth client
    const oauth2Client = await getGoogleOAuthClient(connectionId);
    const sheets = google.sheets({ version: "v4", auth: oauth2Client });

    // Log token state for debugging
    const credentials = oauth2Client.credentials;
    console.log("[Google Sheets] OAuth client credentials state:", {
      hasAccessToken: !!credentials.access_token,
      tokenExpired: credentials.expiry_date ? new Date(credentials.expiry_date) < new Date() : "unknown",
      expiryDate: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : "none",
    });

    // Fetch spreadsheet metadata
    let response;
    try {
      response = await sheets.spreadsheets.get({
        spreadsheetId,
        fields: "sheets(properties(sheetId,title,index,gridProperties))",
      });
    } catch (sheetsError: unknown) {
      const error = sheetsError as Record<string, unknown>;
      console.error("[Google Sheets] spreadsheets.get() failed:", {
        status: (error as Record<string, unknown>).status,
        code: (error as Record<string, unknown>).code,
        message: (error as Record<string, unknown>).message,
        errors: (error as Record<string, unknown>).errors,
      });
      if ((error as Record<string, unknown>).status === 403) {
        return NextResponse.json(
          {
            error: "Google API permission denied",
            details: "The Google Sheets API may not be enabled in your Google Cloud project, or the access token has expired. Try disconnecting and reconnecting your Google account.",
            apiError: (error as Record<string, unknown>).message,
          },
          { status: 403 }
        );
      }
      throw sheetsError;
    }

    if (!response.data.sheets) {
      console.warn("[Google Sheets] No sheets found in spreadsheet:", spreadsheetId);
      return NextResponse.json({ sheets: [] });
    }

    const sheetsList = response.data.sheets.map((sheet) => ({
      sheetId: sheet.properties!.sheetId!,
      title: sheet.properties!.title!,
      index: sheet.properties!.index!,
      rowCount: sheet.properties!.gridProperties?.rowCount || 0,
      columnCount: sheet.properties!.gridProperties?.columnCount || 0,
    }));

    console.log("[Google Sheets] Successfully fetched sheets:", sheetsList.length);
    return NextResponse.json({ sheets: sheetsList });
  } catch (error: unknown) {
    const errorObj = error as Record<string, unknown>;
    console.error("[Google Sheets] Error fetching sheets:", {
      message: (errorObj).message,
      status: (errorObj).status,
      code: (errorObj).code,
      stack: (errorObj).stack,
    });
    return NextResponse.json(
      {
        error: "Failed to fetch sheets",
        details: (errorObj as Record<string, unknown>).message || "Unknown error",
        code: (errorObj as Record<string, unknown>).code,
      },
      { status: (errorObj as Record<string, unknown>).status === 403 ? 403 : 500 }
    );
  }
}
