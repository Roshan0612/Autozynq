"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function CreateWorkflowForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          definition: {
            nodes: [
              {
                id: "trigger1",
                type: "trigger.manual",
                config: { payload: {} },
              },
            ],
            edges: [],
            ui: { positions: { trigger1: { x: 250, y: 100 } } },
          },
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || "Failed to create workflow");
        return;
      }

      const workflowId = json?.workflow?.id;
      if (workflowId) {
        router.push(`/workflows/${workflowId}/builder`);
      } else {
        setError("Workflow created but no ID returned");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create workflow");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="font-mono text-sm">Create Workflow</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1">
            <label className="font-mono text-xs text-muted-foreground">Name</label>
            <input
              className="rounded border px-3 py-2 text-sm"
              placeholder="My First Workflow"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create and open builder"}
            </Button>
            <span className="text-xs text-muted-foreground font-mono">Starts with an empty canvas</span>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
