"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import ModeToggle from "../global/ModeToggle";

const sidebarItems = [
  { name: "Dashboard", icon: Home, href: "/dashboard" },
  { name: "Workflows", icon: Workflow, href: "/workflows" },
  { name: "Executions", icon: Activity, href: "/executions" },
  { name: "Triggers", icon: Webhook, href: "/triggers" },
  { name: "Settings", icon: Settings, href: "/settings" },
  { name: "Connections", icon: Plug, href: "/dashboard/connections" },
  { name: "Payment", icon: CreditCard, href: "/dashboard/payment" },
  { name: "Billings", icon: Receipt, href: "/dashboard/billings" },
  { name: "Templates", icon: FileText, href: "/dashboard/templates" },
  { name: "Log", icon: ScrollText, href: "/dashboard/log" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <TooltipProvider>
      <aside className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-16 border-r bg-background flex flex-col items-center py-4 gap-2">
        {sidebarItems.map((item) => {
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
