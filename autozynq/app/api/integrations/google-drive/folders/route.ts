import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { listFolders } from "@/lib/integrations/google/drive";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/integrations/google-drive/folders
 * List folders for folder picker
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const connectionId = searchParams.get("connectionId");

  if (!connectionId) {
    return NextResponse.json({ error: "connectionId is required" }, { status: 400 });
  }

  // Verify connection belongs to user
  const connection = await prisma.connection.findUnique({
    where: { id: connectionId },
  });

  if (!connection || connection.userId !== session.user.id) {
    return NextResponse.json({ error: "Connection not found or unauthorized" }, { status: 404 });
  }

  try {
    const folders = await listFolders(connectionId);
    return NextResponse.json({ folders });
  } catch (error: any) {
    console.error("[Google Drive] Error listing folders:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch folders",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
