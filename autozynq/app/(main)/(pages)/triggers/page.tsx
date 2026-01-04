import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth/options";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { CopyButton } from "@/app/components/CopyButton";

async function getTriggers() {
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

  // Fetch all triggers for user's workflows
  const triggers = await prisma.workflowTrigger.findMany({
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
    orderBy: { createdAt: "desc" },
  });

  return triggers;
}

export default async function TriggersPage() {
  const triggers = await getTriggers();
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-mono font-bold mb-2">Triggers</h1>
        <p className="text-sm text-muted-foreground">
          Debug webhook & trigger behavior. Verify real-world events reach the engine.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          (Scaffold UI - webhook event logging coming soon)
        </p>
      </div>

      {triggers.length === 0 ? (
        <div className="border border-dashed rounded-lg p-12 text-center">
          <p className="text-muted-foreground">No triggers registered</p>
          <p className="text-sm text-muted-foreground mt-2">
            Activate a workflow to register triggers
          </p>
        </div>
      ) : (
        <div className="grid gap-6">
          {triggers.map((trigger) => {
            const webhookUrl = `${baseUrl}/api/webhooks/${trigger.id}`;

            return (
              <Card key={trigger.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="font-mono text-sm mb-1">
                        {trigger.nodeId}
                      </CardTitle>
                      <Link
                        href={`/workflows/${trigger.workflow.id}`}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        {trigger.workflow.name}
                      </Link>
                    </div>
                    <Badge
                      variant={trigger.isActive ? "default" : "secondary"}
                    >
                      {trigger.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <dl className="space-y-3 text-sm">
                    <div>
                      <dt className="font-mono text-xs text-muted-foreground mb-1">
                        Trigger ID
                      </dt>
                      <dd className="font-mono text-xs bg-muted p-2 rounded">
                        {trigger.id}
                      </dd>
                    </div>

                    <div>
                      <dt className="font-mono text-xs text-muted-foreground mb-1">
                        Type
                      </dt>
                      <dd className="font-mono text-xs">
                        <Badge variant="outline">{trigger.type}</Badge>
                      </dd>
                    </div>

                    {trigger.type === "WEBHOOK" && (
                      <div>
                        <dt className="font-mono text-xs text-muted-foreground mb-1">
                          Webhook URL
                        </dt>
                        <dd className="font-mono text-xs bg-muted p-2 rounded break-all flex items-center justify-between gap-2">
                          <span className="flex-1">{webhookUrl}</span>
                          <CopyButton text={webhookUrl} />
                        </dd>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <dt className="font-mono text-xs text-muted-foreground">
                          Created
                        </dt>
                        <dd className="text-xs">
                          {new Date(trigger.createdAt).toLocaleString()}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-mono text-xs text-muted-foreground">
                          Updated
                        </dt>
                        <dd className="text-xs">
                          {new Date(trigger.updatedAt).toLocaleString()}
                        </dd>
                      </div>
                    </div>

                    {/* Placeholder for future webhook event logging */}
                    <div className="pt-4 border-t">
                      <dt className="font-mono text-xs text-muted-foreground mb-2">
                        Recent Events
                      </dt>
                      <dd className="text-xs text-muted-foreground italic">
                        Webhook event logging not yet implemented
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
