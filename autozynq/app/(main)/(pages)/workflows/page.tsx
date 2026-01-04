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

async function getWorkflows() {
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

  // Fetch workflows directly from database
  const workflows = await prisma.workflow.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return workflows;
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, "default" | "secondary" | "outline"> = {
    DRAFT: "outline",
    ACTIVE: "default",
    PAUSED: "secondary",
  };

  return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
}

export default async function WorkflowsPage() {
  const workflows = await getWorkflows();

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-mono font-bold mb-2">Workflows</h1>
        <p className="text-sm text-muted-foreground">
          Read-only workflow inspector. Verify schema correctness and node graph structure.
        </p>
      </div>

      {workflows.length === 0 ? (
        <div className="border border-dashed rounded-lg p-12 text-center">
          <p className="text-muted-foreground">No workflows found</p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-mono">ID</TableHead>
                <TableHead className="font-mono">Name</TableHead>
                <TableHead className="font-mono">Status</TableHead>
                <TableHead className="font-mono">Created</TableHead>
                <TableHead className="font-mono">Updated</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workflows.map((workflow: any) => (
                <TableRow key={workflow.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {workflow.id.slice(0, 8)}...
                  </TableCell>
                  <TableCell className="font-medium">{workflow.name}</TableCell>
                  <TableCell>
                    <StatusBadge status={workflow.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(workflow.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(workflow.updatedAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/workflows/${workflow.id}`}
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
