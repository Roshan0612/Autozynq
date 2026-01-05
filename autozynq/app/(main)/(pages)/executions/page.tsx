import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth/options";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/prisma";

async function getExecutions() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/api/auth/signin");
  }

  // Get user
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return [];
  }

  // Fetch executions directly from database
  const executions = await prisma.execution.findMany({
    where: {
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
    orderBy: { startedAt: "desc" },
    take: 100,
  });

  return executions;
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

function DurationDisplay({
  startedAt,
  finishedAt,
}: {
  startedAt: string;
  finishedAt: string | null;
}) {
  if (!finishedAt) {
    return <span className="text-muted-foreground">—</span>;
  }

  const start = new Date(startedAt).getTime();
  const end = new Date(finishedAt).getTime();
  const durationMs = end - start;

  if (durationMs < 1000) {
    return <span>{durationMs}ms</span>;
  }

  const seconds = (durationMs / 1000).toFixed(2);
  return <span>{seconds}s</span>;
}

export default async function ExecutionsPage() {
  const executions = await getExecutions();

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-mono font-bold mb-2">Executions</h1>
        <p className="text-sm text-muted-foreground">
          CRITICAL: Engine debugger. If this view is bad, the engine cannot be trusted.
        </p>
      </div>

      {executions.length === 0 ? (
        <div className="border border-dashed rounded-lg p-12 text-center">
          <p className="text-muted-foreground">No executions found</p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-mono">ID</TableHead>
                <TableHead className="font-mono">Workflow</TableHead>
                <TableHead className="font-mono">Status</TableHead>
                <TableHead className="font-mono">Started</TableHead>
                <TableHead className="font-mono">Finished</TableHead>
                <TableHead className="font-mono">Duration</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {executions.map((execution: any) => (
                <TableRow key={execution.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {execution.id.slice(0, 8)}...
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/workflows/${execution.workflow.id}`}
                      className="text-sm hover:underline"
                    >
                      {execution.workflow.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={execution.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(execution.startedAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {execution.finishedAt
                      ? new Date(execution.finishedAt).toLocaleString()
                      : "—"}
                  </TableCell>
                  <TableCell className="text-sm font-mono">
                    <DurationDisplay
                      startedAt={execution.startedAt}
                      finishedAt={execution.finishedAt}
                    />
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/executions/${execution.id}`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      View →
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
