import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  User, 
  Mail, 
  Calendar, 
  Key, 
  Shield, 
  Workflow, 
  Activity, 
  Plug, 
  Clock,
  Copy,
  CheckCircle2
} from "lucide-react";
import { CopyButton } from "@/app/components/CopyButton";

async function getUserData() {
  const session = (await getServerSession(authOptions)) as { user?: { email?: string; name?: string; image?: string } } | null;
  
  if (!session?.user?.email) {
    redirect("/api/auth/signin");
  }

  // Get user with account details
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      accounts: {
        select: {
          provider: true,
          type: true,
        },
      },
      _count: {
        select: {
          workflows: true,
          connections: true,
        },
      },
    },
  });

  if (!user) {
    redirect("/api/auth/signin");
  }

  // Get workflow stats
  const activeWorkflows = await prisma.workflow.count({
    where: { userId: user.id, status: "ACTIVE" },
  });

  const totalExecutions = await prisma.execution.count({
    where: { workflow: { userId: user.id } },
  });

  // Get last execution time
  const lastExecution = await prisma.execution.findFirst({
    where: { workflow: { userId: user.id } },
    orderBy: { startedAt: "desc" },
    select: { startedAt: true },
  });

  return {
    user,
    stats: {
      totalWorkflows: user._count.workflows,
      activeWorkflows,
      totalExecutions,
      connectedApps: user._count.connections,
      lastExecutionAt: lastExecution?.startedAt,
    },
  };
}

export default async function SettingsPage() {
  const { user, stats } = await getUserData();

  const primaryProvider = user.accounts[0]?.provider || "email";
  const providerLabel = primaryProvider === "google" ? "Google" : primaryProvider === "github" ? "GitHub" : "Email";

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your account and view platform usage
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* User Profile Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile Information
            </CardTitle>
            <CardDescription>
              Your account details and authentication method
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Name */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Name
                </label>
                <div className="text-base font-medium">
                  {user.name || "Not set"}
                </div>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email
                </label>
                <div className="text-base font-medium">
                  {user.email}
                </div>
              </div>

              {/* Auth Provider */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Authentication Provider
                </label>
                <div>
                  <Badge variant="secondary" className="font-medium">
                    {providerLabel}
                  </Badge>
                </div>
              </div>

              {/* Account Created */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Account Created
                </label>
                <div className="text-base font-medium">
                  {new Date(user.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </div>
              </div>

              {/* User ID */}
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  User ID
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-muted rounded-md text-sm font-mono">
                    {user.id}
                  </code>
                  <CopyButton text={user.id} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Account Overview
            </CardTitle>
            <CardDescription>
              Summary of your platform usage and activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* Total Workflows */}
              <div className="p-4 border rounded-lg bg-card">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                    <Workflow className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-2xl font-bold">{stats.totalWorkflows}</span>
                </div>
                <p className="text-sm font-medium text-muted-foreground">Total Workflows</p>
              </div>

              {/* Active Workflows */}
              <div className="p-4 border rounded-lg bg-card">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="text-2xl font-bold">{stats.activeWorkflows}</span>
                </div>
                <p className="text-sm font-medium text-muted-foreground">Active Workflows</p>
              </div>

              {/* Total Executions */}
              <div className="p-4 border rounded-lg bg-card">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                    <Activity className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <span className="text-2xl font-bold">{stats.totalExecutions}</span>
                </div>
                <p className="text-sm font-medium text-muted-foreground">Total Executions</p>
              </div>

              {/* Connected Apps */}
              <div className="p-4 border rounded-lg bg-card">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 bg-amber-100 dark:bg-amber-900/20 rounded-lg">
                    <Plug className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <span className="text-2xl font-bold">{stats.connectedApps}</span>
                </div>
                <p className="text-sm font-medium text-muted-foreground">Connected Apps</p>
              </div>

              {/* Last Execution */}
              <div className="p-4 border rounded-lg bg-card md:col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 bg-slate-100 dark:bg-slate-900/20 rounded-lg">
                    <Clock className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                  </div>
                  <span className="text-sm font-medium">
                    {stats.lastExecutionAt
                      ? new Date(stats.lastExecutionAt).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Never"}
                  </span>
                </div>
                <p className="text-sm font-medium text-muted-foreground">Last Execution</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Platform Info */}
        <Card>
          <CardHeader>
            <CardTitle>Platform Information</CardTitle>
            <CardDescription>
              Version and system details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">Platform Version</span>
                <Badge variant="outline">v1.0.0</Badge>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">Account Status</span>
                <Badge variant="default" className="bg-green-600">Active</Badge>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-muted-foreground">Account Type</span>
                <Badge variant="secondary">Free</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
