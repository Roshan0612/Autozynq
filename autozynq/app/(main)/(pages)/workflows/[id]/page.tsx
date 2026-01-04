import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth/options";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

  return workflow;
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, "default" | "secondary" | "outline"> = {
    DRAFT: "outline",
    ACTIVE: "default",
    PAUSED: "secondary",
  };

  return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
}

export default async function WorkflowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workflow = await getWorkflow(id);

  if (!workflow) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="border border-dashed rounded-lg p-12 text-center">
          <p className="text-muted-foreground">Workflow not found</p>
          <Link href="/workflows" className="text-blue-600 hover:underline mt-4 inline-block">
            ← Back to workflows
          </Link>
        </div>
      </div>
    );
  }

  const definition = workflow.definition as any;
  const nodes = definition?.nodes || [];
  const edges = definition?.edges || [];

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <Link href="/workflows" className="text-sm text-blue-600 hover:underline mb-2 inline-block">
          ← Back to workflows
        </Link>
        <h1 className="text-2xl font-mono font-bold">{workflow.name}</h1>
        <p className="text-sm text-muted-foreground">
          Workflow detail view. Raw data only. No editing.
        </p>
      </div>

      {/* Workflow Metadata */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="font-mono text-lg">Metadata</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="font-mono text-muted-foreground">ID</dt>
              <dd className="font-mono">{workflow.id}</dd>
            </div>
            <div>
              <dt className="font-mono text-muted-foreground">Status</dt>
              <dd>
                <StatusBadge status={workflow.status} />
              </dd>
            </div>
            <div>
              <dt className="font-mono text-muted-foreground">Created At</dt>
              <dd>{new Date(workflow.createdAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="font-mono text-muted-foreground">Updated At</dt>
              <dd>{new Date(workflow.updatedAt).toLocaleString()}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Workflow JSON Definition */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="font-mono text-lg">Definition (JSON)</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
            {JSON.stringify(workflow.definition, null, 2)}
          </pre>
        </CardContent>
      </Card>

      {/* Nodes Breakdown */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="font-mono text-lg">
            Nodes ({nodes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {nodes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No nodes defined</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-mono">Node ID</TableHead>
                    <TableHead className="font-mono">Type</TableHead>
                    <TableHead className="font-mono">Config</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nodes.map((node: any) => (
                    <TableRow key={node.id}>
                      <TableCell className="font-mono text-sm">
                        {node.id}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {node.type}
                      </TableCell>
                      <TableCell>
                        <pre className="text-xs bg-muted p-2 rounded max-w-md overflow-x-auto">
                          {JSON.stringify(node.config, null, 2)}
                        </pre>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edges Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="font-mono text-lg">
            Edges ({edges.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {edges.length === 0 ? (
            <p className="text-sm text-muted-foreground">No edges defined</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-mono">From</TableHead>
                    <TableHead className="font-mono">To</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {edges.map((edge: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-sm">
                        {edge.from}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        → {edge.to}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
