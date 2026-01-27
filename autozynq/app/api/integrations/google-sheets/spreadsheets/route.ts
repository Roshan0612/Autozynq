import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getGoogleOAuthClient } from "@/lib/integrations/google/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/integrations/google-sheets/spreadsheets
 * Fetches user's Google Spreadsheets from Drive API
 * Query params: connectionId
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const connectionId = searchParams.get("connectionId");

    if (!connectionId) {
      return NextResponse.json(
        { error: "connectionId is required" },
        { status: 400 }
      );
    }

    // Get connection from database
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

    // Get OAuth client
    const oauth2Client = await getGoogleOAuthClient(connectionId);
    const drive = google.drive({ version: "v3", auth: oauth2Client });

    // Fetch spreadsheets from Drive
    const response = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
      fields: "files(id, name, createdTime, modifiedTime)",
      pageSize: 100,
      orderBy: "modifiedTime desc",
    });

    const spreadsheets = (response.data.files || []).map((file) => ({
      id: file.id!,
      name: file.name!,
      createdTime: file.createdTime,
      modifiedTime: file.modifiedTime,
    }));

    return NextResponse.json({ spreadsheets });
  } catch (error: any) {
    console.error("[Google Sheets] Error fetching spreadsheets:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch spreadsheets",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
