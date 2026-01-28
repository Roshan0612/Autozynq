import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
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

async function getTriggerSubscription(id: string) {
  const session = (await getServerSession(authOptions)) as { user?: { email?: string } } | null;
  if (!session?.user?.email) {
    redirect("/api/auth/signin");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return null;
  }

  const subscription = await prisma.triggerSubscription.findUnique({
    where: { id },
    include: {
      workflow: {
        select: {
          id: true,
          name: true,
          status: true,
          userId: true,
        },
      },
    },
  });

  // Verify user owns this workflow
  if (!subscription || subscription.workflow.userId !== user.id) {
    return null;
  }

  return subscription;
}

// Fetch linked executions for this trigger
async function getLinkedExecutions(
  workflowId: string,
  limit: number = 10
) {
  const executions = await prisma.execution.findMany({
    where: {
      workflowId: workflowId,
    },
    include: {
      workflow: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      startedAt: "desc",
    },
    take: limit,
  });

  return executions;
}

function getStatusColor(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "PENDING":
      return "secondary";
    case "RUNNING":
      return "secondary";
    case "SUCCESS":
      return "default";
    case "FAILED":
      return "destructive";
    case "CANCEL_REQUESTED":
      return "secondary";
    case "ABORTED":
      return "outline";
    default:
      return "outline";
  }
}

export default async function TriggerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const subscription = await getTriggerSubscription(id);

  if (!subscription) {
    notFound();
  }

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const webhookUrl = `${baseUrl}/api/webhooks/${subscription.webhookPath}`;
  const linkedExecutions = await getLinkedExecutions(subscription.workflowId);

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Link
            href="/triggers"
            className="text-sm text-blue-600 hover:underline"
          >
            ← Back to Triggers
          </Link>
        </div>
        <h1 className="text-2xl font-mono font-bold">Trigger Details</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Webhook: <span className="font-mono text-xs">{subscription.webhookPath}</span>
        </p>
      </div>

      {/* Summary Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3">
            <div>
              <dt className="font-mono text-xs text-muted-foreground mb-1">
                Subscription ID
              </dt>
              <dd className="font-mono text-xs bg-muted p-2 rounded">
                {subscription.id}
              </dd>
            </div>

            <div>
              <dt className="font-mono text-xs text-muted-foreground mb-1">
                Workflow
              </dt>
              <dd>
                <Link
                  href={`/workflows/${subscription.workflow.id}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  {subscription.workflow.name}
                </Link>
              </dd>
            </div>

            <div>
              <dt className="font-mono text-xs text-muted-foreground mb-1">
                Trigger Node
              </dt>
              <dd className="font-mono text-xs bg-muted p-2 rounded">
                {subscription.nodeId}
              </dd>
            </div>

            <div>
              <dt className="font-mono text-xs text-muted-foreground mb-1">
                Trigger Type
              </dt>
              <dd>
                <Badge variant="outline">{subscription.triggerType}</Badge>
              </dd>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <dt className="font-mono text-xs text-muted-foreground mb-1">
                  Total Executions
                </dt>
                <dd className="text-lg font-bold">
                  {subscription.executionCount}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-xs text-muted-foreground mb-1">
                  Created
                </dt>
                <dd className="text-sm">
                  {new Date(subscription.createdAt).toLocaleString()}
                </dd>
              </div>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Webhook URL Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Webhook URL</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              POST to this URL to trigger workflow execution:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted p-3 rounded font-mono text-xs break-all">
                {webhookUrl}
              </code>
              <CopyButton text={webhookUrl} />
            </div>
            <div className="text-xs text-muted-foreground bg-blue-50 border border-blue-200 dark:bg-blue-950 dark:border-blue-800 p-2 rounded">
              <p className="font-semibold mb-1">Example cURL request:</p>
              <code className="block font-mono text-xs bg-muted p-2 rounded mt-1">
                curl -X POST {webhookUrl} \
                <br />
                &nbsp;&nbsp;-H &quot;Content-Type: application/json&quot; \
                <br />
                &nbsp;&nbsp;-d {`'{\"your\": \"payload\"}'`}
              </code>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Last Payload Card */}
      {subscription.lastPayload && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Last Payload</CardTitle>
          </CardHeader>
          <CardContent>
            <details className="cursor-pointer">
              <summary className="text-sm font-mono text-muted-foreground hover:text-foreground">
                View JSON
              </summary>
              <pre className="mt-3 bg-muted p-3 rounded font-mono text-xs overflow-auto max-h-96 border">
                {JSON.stringify(subscription.lastPayload, null, 2)}
              </pre>
            </details>
          </CardContent>
        </Card>
      )}

      {/* Recent Executions Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Executions</CardTitle>
        </CardHeader>
        <CardContent>
          {linkedExecutions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No executions from this trigger yet
            </p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-mono">Execution ID</TableHead>
                    <TableHead className="font-mono">Status</TableHead>
                    <TableHead className="font-mono">Started</TableHead>
                    <TableHead className="font-mono">Duration</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linkedExecutions.map((execution: Record<string, unknown>) => {
                    const duration =
                      execution.finishedAt && execution.startedAt
                        ? Math.round(
                            (new Date(execution.finishedAt as string | number).getTime() -
                              new Date(execution.startedAt as string | number).getTime()) /
                              1000
                          )
                        : null;

                    return (
                      <TableRow key={String(execution.id)}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {String(execution.id).substring(0, 8)}...
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusColor(String(execution.status))}>
                            {String(execution.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(execution.startedAt as Date).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {duration !== null ? `${duration}s` : "—"}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/executions/${String(execution.id)}`}
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
    </div>
  );
}
