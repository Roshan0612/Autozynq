import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";

async function getWorkflow(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/api/auth/signin");
  }

  // Get user
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return null;
  }

  // Fetch workflow directly from database
  const workflow = await prisma.workflow.findFirst({
    where: {
      id,
      userId: user.id,
    },
  });

  if (!workflow) {
    return null;
  }

  return { workflow };
}
export default async function WorkflowDetailPage({ params }: { params: { id: string } }) {
  const wf = await getWorkflow(params.id);
  if (!wf) {
    redirect("/workflows");
  }
  const { workflow } = wf;
  const definition = (workflow.definition as any) || {};
  const nodes = definition.nodes || [];
  const edges = definition.edges || [];

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <Link href="/workflows" className="text-sm text-blue-600 hover:underline mb-2 inline-block">
          ← Back to workflows
        </Link>
        <h1 className="text-2xl font-bold">{workflow.name}</h1>
      </div>

      <div className="mb-6">
        <p className="text-sm text-muted-foreground">Open the visual builder to edit this workflow.</p>
        <Link
          href={`/workflows/${workflow.id}/builder`}
          className="inline-block mt-2 px-4 py-2 border rounded hover:bg-accent"
        >
          Open Builder
        </Link>
      </div>

      <div className="text-sm">
        <div className="mb-2">Nodes: {nodes.length}</div>
        <div>Edges: {edges.length}</div>
      </div>
    </div>
  );
}
