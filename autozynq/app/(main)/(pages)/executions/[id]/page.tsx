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

async function getExecution(id: string) {
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

  // Fetch execution directly from database
  const execution = await prisma.execution.findFirst({
    where: {
      id,
      workflow: {
        userId: user.id,
      },
    },
    include: {
      workflow: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
    },
  });

  return execution;
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<
    string,
    { variant: "default" | "secondary" | "outline" | "destructive"; color: string }
  > = {
    PENDING: { variant: "outline", color: "text-gray-600" },
    RUNNING: { variant: "secondary", color: "text-yellow-600" },
    SUCCESS: { variant: "default", color: "text-green-600" },
    FAILED: { variant: "destructive", color: "text-red-600" },
    CANCEL_REQUESTED: { variant: "secondary", color: "text-amber-700" },
    ABORTED: { variant: "outline", color: "text-red-700" },
  };

  const { variant, color } = config[status] || config.PENDING;

  return (
    <Badge variant={variant} className={color}>
      {status}
    </Badge>
  );
}

function StepStatusBadge({ status }: { status: string }) {
  const config: Record<
    string,
    { variant: "default" | "secondary" | "outline" | "destructive" }
  > = {
    running: { variant: "secondary" },
    success: { variant: "default" },
    failed: { variant: "destructive" },
    skipped: { variant: "outline" },
    aborted: { variant: "outline" },
  };

  const { variant } = config[status] || config.running;

  return (
    <Badge variant={variant} className="text-xs">
      {status}
    </Badge>
  );
}

export default async function ExecutionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const execution = await getExecution(id);

  if (!execution) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="border border-dashed rounded-lg p-12 text-center">
          <p className="text-muted-foreground">Execution not found</p>
          <Link
            href="/executions"
            className="text-blue-600 hover:underline mt-4 inline-block"
          >
            ← Back to executions
          </Link>
        </div>
      </div>
    );
  }

  const steps = (execution.steps as any[]) || [];
  const error = execution.error as any;
  const duration = execution.finishedAt
    ? new Date(execution.finishedAt).getTime() -
      new Date(execution.startedAt).getTime()
    : null;

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-6">
        <Link
          href="/executions"
          className="text-sm text-blue-600 hover:underline mb-2 inline-block"
        >
          ← Back to executions
        </Link>
        <h1 className="text-2xl font-mono font-bold mb-1">Execution Detail</h1>
        <p className="text-sm text-muted-foreground">
          Engine debugger. This page must answer: "Why did this execution fail?"
        </p>
      </div>

      {/* Trigger Payload */}
      {execution.result && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="font-mono text-lg">Trigger Payload</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Raw webhook payload or manual trigger input
            </p>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
              {JSON.stringify(execution.result, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Execution Summary */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="font-mono text-lg">Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="font-mono text-muted-foreground">Execution ID</dt>
              <dd className="font-mono text-xs">{execution.id}</dd>
            </div>
            <div>
              <dt className="font-mono text-muted-foreground">Status</dt>
              <dd>
                <StatusBadge status={execution.status} />
              </dd>
            </div>
            <div>
              <dt className="font-mono text-muted-foreground">Workflow</dt>
              <dd>
                <Link
                  href={`/workflows/${execution.workflow.id}`}
                  className="text-blue-600 hover:underline"
                >
                  {execution.workflow.name}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="font-mono text-muted-foreground">Workflow ID</dt>
              <dd className="font-mono text-xs">{execution.workflowId}</dd>
            </div>
            <div>
              <dt className="font-mono text-muted-foreground">Started At</dt>
              <dd>{new Date(execution.startedAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="font-mono text-muted-foreground">Finished At</dt>
              <dd>
                {execution.finishedAt
                  ? new Date(execution.finishedAt).toLocaleString()
                  : "—"}
              </dd>
            </div>
            {duration !== null && (
              <div>
                <dt className="font-mono text-muted-foreground">Duration</dt>
                <dd className="font-mono">
                  {duration < 1000
                    ? `${duration}ms`
                    : `${(duration / 1000).toFixed(2)}s`}
                </dd>
              </div>
            )}
            {execution.status === "ABORTED" && execution.abortedAt && (
              <div>
                <dt className="font-mono text-muted-foreground">Aborted At</dt>
                <dd>{new Date(execution.abortedAt).toLocaleString()}</dd>
              </div>
            )}
            {execution.status === "ABORTED" && execution.abortedBy && (
              <div>
                <dt className="font-mono text-muted-foreground">Aborted By</dt>
                <dd className="font-mono text-xs">{execution.abortedBy}</dd>
              </div>
            )}
            {execution.status === "ABORTED" && execution.abortReason && (
              <div className="col-span-2">
                <dt className="font-mono text-muted-foreground">Abort Reason</dt>
                <dd className="font-mono text-xs bg-muted p-2 rounded border mt-1">
                  {execution.abortReason}
                </dd>
              </div>
            )}
          </dl>

          {execution.result && (
            <div className="mt-6">
              <dt className="font-mono text-muted-foreground mb-2">
                Final Result
              </dt>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
                {JSON.stringify(execution.result, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Execution Error (if FAILED) */}
      {execution.status === "FAILED" && error && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="font-mono text-lg text-red-600">
              ⚠️ Execution Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="font-mono text-muted-foreground mb-1">
                  Error Message
                </dt>
                <dd className="font-mono text-red-600 bg-white p-3 rounded border border-red-200">
                  {error.message}
                </dd>
              </div>

              {error.nodeId && (
                <div>
                  <dt className="font-mono text-muted-foreground">
                    Failed Node ID
                  </dt>
                  <dd className="font-mono">{error.nodeId}</dd>
                </div>
              )}

              {error.stepIndex !== undefined && (
                <div>
                  <dt className="font-mono text-muted-foreground">
                    Failed at Step
                  </dt>
                  <dd className="font-mono">{error.stepIndex}</dd>
                </div>
              )}

              {error.stack && (
                <details className="mt-4">
                  <summary className="font-mono text-muted-foreground cursor-pointer hover:text-foreground">
                    Stack Trace (click to expand)
                  </summary>
                  <pre className="mt-2 bg-white p-4 rounded border border-red-200 overflow-x-auto text-xs">
                    {error.stack}
                  </pre>
                </details>
              )}
            </dl>
          </CardContent>
        </Card>
      )}

      {/* Step Logs (MOST IMPORTANT) */}
      <Card>
        <CardHeader>
          <CardTitle className="font-mono text-lg">
            Step Logs ({steps.length} steps)
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Sequential execution log. Shows node execution order and outputs.
          </p>
        </CardHeader>
        <CardContent>
          {steps.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No steps recorded (execution may have failed before any nodes ran)
            </p>
          ) : (
            <div className="space-y-6">
              {steps.map((step: any, idx: number) => {
                const stepDuration = step.finishedAt
                  ? new Date(step.finishedAt).getTime() -
                    new Date(step.startedAt).getTime()
                  : null;

                return (
                  <div
                    key={idx}
                    className={`border rounded-lg p-4 ${
                      step.status === "failed"
                        ? "border-red-300 bg-red-50"
                        : step.status === "skipped"
                        ? "border-dashed border-muted-foreground/40 bg-muted/30"
                        : step.status === "aborted"
                        ? "border-amber-200 bg-amber-50"
                        : "border-border"
                    }`}
                  >
                    {/* Step Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="font-mono text-lg font-bold text-muted-foreground">
                          #{idx + 1}
                        </div>
                        <div>
                          <div className="font-mono text-sm font-medium">
                            {step.nodeId}
                          </div>
                          <div className="font-mono text-xs text-muted-foreground">
                            {step.nodeType || "Unknown Type"}
                          </div>
                        </div>
                      </div>
                      <StepStatusBadge status={step.status} />
                    </div>

                    {/* Step Metadata */}
                    <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
                      <div>
                        <dt className="font-mono text-xs text-muted-foreground">
                          Started
                        </dt>
                        <dd className="font-mono text-xs">
                          {new Date(step.startedAt).toLocaleTimeString()}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-mono text-xs text-muted-foreground">
                          Finished
                        </dt>
                        <dd className="font-mono text-xs">
                          {step.finishedAt
                            ? new Date(step.finishedAt).toLocaleTimeString()
                            : "—"}
                        </dd>
                      </div>
                      {stepDuration !== null && (
                        <div>
                          <dt className="font-mono text-xs text-muted-foreground">
                            Duration
                          </dt>
                          <dd className="font-mono text-xs">
                            {stepDuration < 1000
                              ? `${stepDuration}ms`
                              : `${(stepDuration / 1000).toFixed(2)}s`}
                          </dd>
                        </div>
                      )}
                    </div>

                    {/* Step Output */}
                    {step.output && (
                      <div className="mb-4">
                        <dt className="font-mono text-xs text-muted-foreground mb-2">
                          Output
                        </dt>
                        <pre className="bg-muted p-3 rounded text-xs overflow-x-auto max-h-64">
                          {JSON.stringify(step.output, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Step Error */}
                    {step.error && (
                      <div>
                        <dt className="font-mono text-xs text-muted-foreground mb-2">
                          Error
                        </dt>
                        <pre className="bg-red-100 border border-red-300 p-3 rounded text-xs text-red-600">
                          {step.error}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
