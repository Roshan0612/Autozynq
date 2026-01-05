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
import { CopyButton } from "@/app/components/CopyButton";

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

  const triggerSubscriptions = await prisma.triggerSubscription.findMany({
    where: { workflowId: workflow.id },
    orderBy: { createdAt: "desc" },
  });

  return { workflow, triggerSubscriptions };
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
  const workflowData = await getWorkflow(id);

  if (!workflowData) {
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

  const { workflow, triggerSubscriptions } = workflowData;

  const definition = workflow.definition as any;
  const nodes = definition?.nodes || [];
  const edges = definition?.edges || [];
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

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
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs text-muted-foreground">
              Build and test this workflow in the visual builder.
            </div>
            <Link
              href={`/workflows/${workflow.id}/builder`}
              className="text-sm text-blue-600 hover:underline font-mono"
            >
              Open Builder →
            </Link>
          </div>
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

      {/* Trigger Info */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="font-mono text-lg">Trigger Info</CardTitle>
          <p className="text-sm text-muted-foreground">
            Webhook subscriptions for this workflow (read-only).
          </p>
        </CardHeader>
        <CardContent>
          {triggerSubscriptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No trigger subscriptions. Activate the workflow to register webhooks.
            </p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-mono">Node ID</TableHead>
                    <TableHead className="font-mono">Type</TableHead>
                    <TableHead className="font-mono">Webhook URL</TableHead>
                    <TableHead className="font-mono">Created</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {triggerSubscriptions.map((sub) => {
                    const webhookUrl = `${baseUrl}/api/webhooks/${sub.webhookPath}`;

                    return (
                      <TableRow key={sub.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {sub.nodeId}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{sub.triggerType}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          <div className="flex items-center gap-2">
                            <span className="truncate">{webhookUrl}</span>
                            <CopyButton text={webhookUrl} />
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(sub.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/triggers/${sub.id}`}
                            className="text-sm text-blue-600 hover:underline"
                          >
                            View →
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
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
