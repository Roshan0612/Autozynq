import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = (await getServerSession(authOptions)) as { user?: { id?: string; email?: string } } | null;
  const userId = session?.user?.id as string | undefined;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connectionId = id;

  // Verify connection belongs to user
  const connection = await prisma.connection.findFirst({
    where: {
      id: connectionId,
      userId,
    },
  });

  if (!connection) {
    return NextResponse.json(
      { error: "Connection not found" },
      { status: 404 }
    );
  }

  // Delete the connection
  await prisma.connection.delete({
    where: { id: connectionId },
  });

  return NextResponse.json({
    message: "Connection disconnected successfully",
  });
}
