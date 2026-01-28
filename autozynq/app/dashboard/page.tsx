"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import Sidebar from "../components/sidebar/Sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, Zap, TrendingUp, Plug2, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState({
    activeWorkflows: 0,
    totalExecutions: 0,
    avgDailyRuns: 0,
    connectedApps: 0,
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  useEffect(() => {
    // Fetch real stats from DB
    const fetchStats = async () => {
      try {
        const [workflowsRes, executionsRes, connectionsRes] = await Promise.all([
          fetch("/api/workflows"),
          fetch("/api/executions"),
          fetch("/api/connections"),
        ]);

        const workflows = await workflowsRes.json();
        const executions = await executionsRes.json();
        const connections = await connectionsRes.json();

        const activeWorkflowCount = Array.isArray(workflows)
          ? workflows.filter((w: any) => w.status === "ACTIVE").length
          : 0;
        const totalExecutionCount = Array.isArray(executions) ? executions.length : 0;
        const connectedAppsCount = Array.isArray(connections) ? connections.length : 0;

        // Calculate avg daily runs (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentExecutions = Array.isArray(executions)
          ? executions.filter((e: any) => new Date(e.startedAt) > thirtyDaysAgo)
          : [];
        const avgDaily = Math.round(recentExecutions.length / 30);

        setStats({
          activeWorkflows: activeWorkflowCount,
          totalExecutions: totalExecutionCount,
          avgDailyRuns: avgDaily,
          connectedApps: connectedAppsCount,
        });
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      }
    };

    if (status === "authenticated") {
      fetchStats();
    }
  }, [status]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Redirecting to login...</div>
      </div>
    );
  }

  const featuredTemplates = [
    {
      title: "Google Form → Gmail",
      description: "Send email notifications when someone submits a Google Form",
      badge: "Popular",
    },
    {
      title: "Google Form → Google Sheets",
      description: "Automatically add form responses to a spreadsheet",
      badge: "Trending",
    },
    {
      title: "Google Drive → Gmail",
      description: "Get notified when files are added to a Drive folder",
      badge: "New",
    },
  ];

  const suggestedApps = [
    { name: "Google Forms", icon: "📝", color: "bg-purple-100 dark:bg-purple-900/20" },
    { name: "Google Sheets", icon: "📊", color: "bg-green-100 dark:bg-green-900/20" },
    { name: "Google Drive", icon: "📁", color: "bg-blue-100 dark:bg-blue-900/20" },
    { name: "Gmail", icon: "✉️", color: "bg-red-100 dark:bg-red-900/20" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Sidebar />
      <div className="ml-16">
        <div className="container mx-auto px-6 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-2">
              Build, run, and monitor your automations
            </p>
          </div>

          {/* Quick Stats */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Workflows</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.activeWorkflows}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Currently running
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Executions</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalExecutions}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  All time
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Daily Runs</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.avgDailyRuns}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Last 30 days
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Connected Apps</CardTitle>
                <Plug2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.connectedApps}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Authorized
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Featured Templates */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Featured Templates</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {featuredTemplates.map((template, index) => (
                <Card key={index} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{template.title}</CardTitle>
                      <Badge variant="secondary" className="text-xs">
                        {template.badge}
                      </Badge>
                    </div>
                    <CardDescription className="text-sm">
                      {template.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" className="w-full" size="sm">
                      Use Template
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Suggested Apps */}
          <div>
            <div className="mb-4">
              <h2 className="text-xl font-semibold">Suggested Apps</h2>
              <p className="text-sm text-muted-foreground">
                Choose an app to explore more resources and start automating
              </p>
            </div>
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              {suggestedApps.map((app, index) => (
                <Card
                  key={index}
                  className="hover:shadow-md transition-shadow cursor-pointer"
                >
                  <CardContent className="flex flex-col items-center justify-center p-6">
                    <div
                      className={`w-16 h-16 rounded-lg ${app.color} flex items-center justify-center text-3xl mb-3`}
                    >
                      {app.icon}
                    </div>
                    <p className="text-sm font-medium text-center">{app.name}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
