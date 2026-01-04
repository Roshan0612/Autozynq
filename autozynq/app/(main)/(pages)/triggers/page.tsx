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

async function getTriggerSubscriptions() {
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

  // Fetch all trigger subscriptions for user's workflows
  const subscriptions = await prisma.triggerSubscription.findMany({
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
          definition: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return subscriptions;
}

export default async function TriggersPage() {
  const subscriptions = await getTriggerSubscriptions();
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-mono font-bold mb-2">Triggers</h1>
        <p className="text-sm text-muted-foreground">
          Webhook trigger subscriptions. Debug webhook firing and payload reception.
        </p>
      </div>

      {subscriptions.length === 0 ? (
        <div className="border border-dashed rounded-lg p-12 text-center">
          <p className="text-muted-foreground">No trigger subscriptions</p>
          <p className="text-sm text-muted-foreground mt-2">
            Activate a workflow to create a webhook trigger
          </p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-mono">Workflow</TableHead>
                <TableHead className="font-mono">Node</TableHead>
                <TableHead className="font-mono">Type</TableHead>
                <TableHead className="font-mono">Webhook Fires</TableHead>
                <TableHead className="font-mono">Created</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.map((sub: any) => (
                <TableRow key={sub.id}>
                  <TableCell>
                    <Link
                      href={`/workflows/${sub.workflow.id}`}
                      className="text-sm hover:underline text-blue-600"
                    >
                      {sub.workflow.name}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {sub.nodeId}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{sub.triggerType}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    <span className="bg-muted px-2 py-1 rounded">
                      {sub.executionCount} executions
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(sub.createdAt).toLocaleDateString()}
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
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

