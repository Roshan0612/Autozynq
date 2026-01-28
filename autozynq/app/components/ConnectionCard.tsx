"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, RotateCw } from "lucide-react";

export interface ConnectionCardProps {
  id: string;
  provider: string;
  email: string;
  createdAt: string;
  isExpired?: boolean;
  onDisconnect?: (id: string) => Promise<void>;
  onReconnect?: (provider: string) => void;
}

const appConfig: Record<
  string,
  { name: string; icon: string; color: string; bgColor: string }
> = {
  google: {
    name: "Google",
    icon: "🔵",
    color: "text-blue-600",
    bgColor: "bg-blue-100 dark:bg-blue-900/20",
  },
  gmail: {
    name: "Gmail",
    icon: "✉️",
    color: "text-red-600",
    bgColor: "bg-red-100 dark:bg-red-900/20",
  },
  github: {
    name: "GitHub",
    icon: "🐙",
    color: "text-gray-800 dark:text-gray-200",
    bgColor: "bg-gray-100 dark:bg-gray-900/20",
  },
  google_forms: {
    name: "Google Forms",
    icon: "📝",
    color: "text-purple-600",
    bgColor: "bg-purple-100 dark:bg-purple-900/20",
  },
  google_sheets: {
    name: "Google Sheets",
    icon: "📊",
    color: "text-green-600",
    bgColor: "bg-green-100 dark:bg-green-900/20",
  },
  google_drive: {
    name: "Google Drive",
    icon: "📁",
    color: "text-blue-500",
    bgColor: "bg-blue-100 dark:bg-blue-900/20",
  },
};

export function ConnectionCard({
  id,
  provider,
  email,
  createdAt,
  isExpired = false,
  onDisconnect,
  onReconnect,
}: ConnectionCardProps) {
  const [disconnecting, setDisconnecting] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);

  const config = appConfig[provider] || {
    name: provider.charAt(0).toUpperCase() + provider.slice(1),
    icon: "🔗",
    color: "text-gray-600",
    bgColor: "bg-gray-100 dark:bg-gray-900/20",
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      if (onDisconnect) {
        await onDisconnect(id);
      }
      setOpenDialog(false);
    } catch (error) {
      console.error("Failed to disconnect:", error);
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-lg ${config.bgColor} flex items-center justify-center text-xl`}>
              {config.icon}
            </div>
            <div>
              <h3 className="font-semibold text-sm">{config.name}</h3>
              <p className="text-xs text-muted-foreground">{email || "No email"}</p>
            </div>
          </div>
          <Badge
            variant={isExpired ? "destructive" : "default"}
            className={isExpired ? "" : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200"}
          >
            <span className={`inline-block w-2 h-2 rounded-full mr-1 ${isExpired ? "bg-red-600" : "bg-green-600"}`}></span>
            {isExpired ? "Expired" : "Connected"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Added {new Date(createdAt).toLocaleDateString()}
          </span>
          <div className="flex gap-2">
            {isExpired && onReconnect && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onReconnect(provider)}
              >
                <RotateCw className="h-4 w-4 mr-1" />
                Reconnect
              </Button>
            )}
            <AlertDialog open={openDialog} onOpenChange={setOpenDialog}>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Disconnect Account</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to disconnect {config.name}? Active workflows using this connection may be affected.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="flex gap-2 justify-end">
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    {disconnecting ? "Disconnecting..." : "Disconnect"}
                  </AlertDialogAction>
                </div>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
