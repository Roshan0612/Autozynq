import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getGoogleOAuthClient } from "@/lib/integrations/google/auth";
import { connectionHasScopes } from "@/lib/integrations/google/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/integrations/google-sheets/columns/[spreadsheetId]/[sheetName]
 * Fetches column headers (first row) from a sheet
 * Query params: connectionId, headerRow (default: 1)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { spreadsheetId: string; sheetName: string } }
) {
  try {
    const { searchParams } = new URL(req.url);
    const connectionId = searchParams.get("connectionId");
    const headerRow = parseInt(searchParams.get("headerRow") || "1", 10);
    const { spreadsheetId, sheetName } = params;

    if (!connectionId) {
      return NextResponse.json(
        { error: "connectionId is required" },
        { status: 400 }
      );
    }

    if (!spreadsheetId || !sheetName) {
      return NextResponse.json(
        { error: "spreadsheetId and sheetName are required" },
        { status: 400 }
      );
    }

    // Decode sheetName from URL
    const decodedSheetName = decodeURIComponent(sheetName);
    console.log("[Google Sheets] Fetching columns for:", { connectionId, spreadsheetId, decodedSheetName });

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
    const metadata = connection.metadata as any;
    if (!connectionHasScopes(metadata?.scopes as string | undefined, requiredScopes)) {
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

    // Fetch header row
    const range = `'${decodedSheetName}'!${headerRow}:${headerRow}`;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const headers = response.data.values?.[0] || [];

    if (headers.length === 0) {
      console.warn("[Google Sheets] No headers found in sheet:", decodedSheetName);
      return NextResponse.json({ columns: [] });
    }

    // Return column names with their indices
    const columns = headers.map((header, index) => ({
      name: header || `Column ${index + 1}`,
      index: index,
      letter: columnIndexToLetter(index),
    }));

    console.log("[Google Sheets] Successfully fetched columns:", columns.length);
    return NextResponse.json({ columns });
  } catch (error: any) {
    console.error("[Google Sheets] Error fetching columns:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch columns",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

// Helper: Convert column index to letter (0 → A, 1 → B, etc.)
function columnIndexToLetter(index: number): string {
  let letter = "";
  let num = index;
  while (num >= 0) {
    letter = String.fromCharCode((num % 26) + 65) + letter;
    num = Math.floor(num / 26) - 1;
  }
  return letter;
}
