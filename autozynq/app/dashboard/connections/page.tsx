"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import Sidebar from "@/app/components/sidebar/Sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConnectionCard } from "@/app/components/ConnectionCard";
import { Plus, Plug } from "lucide-react";

interface Connection {
  id: string;
  provider: string;
  email: string;
  createdAt: string;
  expiresAt?: string;
}

export default function ConnectionsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchConnections();
    }
  }, [status]);

  const fetchConnections = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/connections");
      if (!response.ok) throw new Error("Failed to fetch connections");
      const data = await response.json();
      setConnections(data);
    } catch (error) {
      console.error("Failed to fetch connections:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async (id: string) => {
    try {
      setDisconnecting(id);
      const response = await fetch(`/api/connections/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to disconnect");
      setConnections((prev) => prev.filter((c) => c.id !== id));
    } catch (error) {
      console.error("Failed to disconnect:", error);
    } finally {
      setDisconnecting(null);
    }
  };

  const handleReconnect = (provider: string) => {
    // Navigate to oauth flow - this would trigger the oauth provider
    window.location.href = `/api/oauth/${provider}/authorize`;
  };

  // Group connections by provider
  const groupedConnections = connections.reduce(
    (acc, conn) => {
      if (!acc[conn.provider]) {
        acc[conn.provider] = [];
      }
      acc[conn.provider].push(conn);
      return acc;
    },
    {} as Record<string, Connection[]>
  );

  const providers = [
    "google",
    "gmail",
    "google_sheets",
    "google_forms",
    "google_drive",
    "github",
  ];

  const sortedProviders = providers.filter((p) => groupedConnections[p]);

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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Sidebar />
      <div className="ml-16">
        <div className="container mx-auto px-6 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">Connections</h1>
            <p className="text-muted-foreground mt-2">
              Manage and reuse your connected app accounts
            </p>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Loading connections...</p>
            </div>
          ) : connections.length === 0 ? (
            // Empty State
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
                <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                  <Plug className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="text-center">
                  <h3 className="font-semibold text-lg">No connections yet</h3>
                  <p className="text-muted-foreground text-sm mt-1">
                    Connect apps to start building automations
                  </p>
                </div>
                <Button
                  size="lg"
                  onClick={() => router.push("/workflows/new")}
                  className="mt-2"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Connect an app
                </Button>
              </CardContent>
            </Card>
          ) : (
            // Connected Accounts
            <div className="space-y-8">
              {sortedProviders.map((provider) => (
                <div key={provider}>
                  <h2 className="text-lg font-semibold mb-4 capitalize">
                    {provider.replace(/_/g, " ")}
                  </h2>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {groupedConnections[provider].map((conn) => (
                      <ConnectionCard
                        key={conn.id}
                        id={conn.id}
                        provider={provider}
                        email={conn.email}
                        createdAt={conn.createdAt}
                        isExpired={
                          conn.expiresAt
                            ? new Date(conn.expiresAt) < new Date()
                            : false
                        }
                        onDisconnect={() => handleDisconnect(conn.id)}
                        onReconnect={handleReconnect}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
