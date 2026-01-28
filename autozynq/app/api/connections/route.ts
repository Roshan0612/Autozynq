import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = (await getServerSession(authOptions)) as { user?: { id?: string; email?: string } } | null;
  const userId = session?.user?.id as string | undefined;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const provider = req.nextUrl.searchParams.get("provider") || undefined;

  const connections = await prisma.connection.findMany({
    where: {
      userId,
      ...(provider ? { provider } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      provider: true,
      metadata: true,
      createdAt: true,
    },
  });

  const results = connections.map((conn) => ({
    id: conn.id,
    provider: conn.provider,
    email: (conn.metadata as Record<string, unknown>)?.email ?? "",
    createdAt: conn.createdAt,
  }));

  return NextResponse.json(results);
}

