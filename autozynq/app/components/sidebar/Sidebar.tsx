"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Settings,
  Plug,
  Workflow,
  Activity,
  Webhook,
  CreditCard,
  Receipt,
  FileText,
  ScrollText,
  Plus,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import ModeToggle from "../global/ModeToggle";

const baseSidebarItems = [
  { name: "Dashboard", icon: Home, href: "/dashboard" },
  { name: "Executions", icon: Activity, href: "/executions" },
  { name: "Triggers", icon: Webhook, href: "/triggers" },
  { name: "Settings", icon: Settings, href: "/settings" },
  { name: "Connections", icon: Plug, href: "/dashboard/connections" },
  { name: "Payment", icon: CreditCard, href: "/dashboard/payment" },
  { name: "Billings", icon: Receipt, href: "/dashboard/billings" },
  { name: "Templates", icon: FileText, href: "/dashboard/templates" },
  { name: "Log", icon: ScrollText, href: "/dashboard/log" },
];

interface Workflow {
  id: string;
  name: string;
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [workflowsExpanded, setWorkflowsExpanded] = useState(true);

  // Fetch workflows on mount
  useEffect(() => {
    const fetchWorkflows = async () => {
      try {
        const res = await fetch("/api/workflows");
        if (res.ok) {
          const data = await res.json();
          setWorkflows(data.workflows || []);
        }
      } catch (error) {
        console.error("Failed to fetch workflows:", error);
      }
    };

    fetchWorkflows();
  }, [pathname]);

  const handleCreateWorkflow = async () => {
    setIsCreating(true);
    try {
      const res = await fetch("/api/workflows/create-empty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Untitled Workflow" }),
      });

      if (res.ok) {
        const data = await res.json();
        const workflowId = data.workflow?.id;
        if (workflowId) {
          router.push(`/workflows/${workflowId}/builder`);
        }
      } else {
        console.error("Failed to create workflow");
      }
    } catch (error) {
      console.error("Error creating workflow:", error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <TooltipProvider>
      <aside className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-16 border-r bg-background flex flex-col items-center py-4 gap-2">
        {/* Create Workflow Button */}
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={handleCreateWorkflow}
              disabled={isCreating}
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-md transition-colors",
                isCreating
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
              aria-label="Create Workflow"
            >
              <Plus className="h-5 w-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>{isCreating ? "Creating..." : "Create Workflow"}</p>
          </TooltipContent>
        </Tooltip>

        {/* Dashboard */}
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Link
              href="/dashboard"
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                pathname === "/dashboard" && "bg-accent text-accent-foreground"
              )}
            >
              <Home className="h-5 w-5" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Dashboard</p>
          </TooltipContent>
        </Tooltip>

        {/* Workflows Section */}
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Link
              href="/workflows"
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground relative",
                pathname?.startsWith("/workflows") && "bg-accent text-accent-foreground"
              )}
            >
              <Workflow className="h-5 w-5" />
              {workflows.length > 0 && (
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
              )}
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs">
            <p className="font-semibold">Workflows ({workflows.length})</p>
            {workflows.length > 0 && (
              <div className="mt-2 max-h-48 overflow-y-auto">
                {workflows.slice(0, 10).map((workflow) => (
                  <Link
                    key={workflow.id}
                    href={`/workflows/${workflow.id}/builder`}
                    className="block px-2 py-1 text-sm hover:bg-accent rounded truncate"
                  >
                    {workflow.name}
                  </Link>
                ))}
                {workflows.length > 10 && (
                  <Link
                    href="/workflows"
                    className="block px-2 py-1 text-xs text-muted-foreground hover:text-accent-foreground"
                  >
                    +{workflows.length - 10} more...
                  </Link>
                )}
              </div>
            )}
            {workflows.length === 0 && (
              <p className="mt-1 text-sm text-muted-foreground">No workflows yet</p>
            )}
          </TooltipContent>
        </Tooltip>

        {/* Separator */}
        <div className="w-8 border-t border-border my-1" />

        {/* Other Navigation Items */}
        {baseSidebarItems.filter(item => item.name !== "Dashboard").map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Tooltip key={item.name} delayDuration={0}>
              <TooltipTrigger asChild>
                <Link
                  href={item.href}
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                    isActive && "bg-accent text-accent-foreground"
                  )}
                >
                  <Icon className="h-5 w-5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{item.name}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
        
        <div className="mt-auto pt-2 w-full flex justify-center">
          <ModeToggle />
        </div>
      </aside>
    </TooltipProvider>
  );
}
