"use client";

import { useEffect, useState } from "react";
import { Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Connection {
  id: string;
  provider: string;
  email: string;
  createdAt: string;
}

interface ConnectionPickerProps {
  provider: string;
  value?: string;
  onChange: (connectionId: string) => void;
}

export function ConnectionPicker({ provider, value, onChange }: ConnectionPickerProps) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchConnections() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/connections?provider=${encodeURIComponent(provider)}`);
      if (!res.ok) {
        throw new Error(`Failed to load connections (${res.status})`);
      }
      const data = (await res.json()) as Connection[];
      setConnections(data);
      // Auto-select first connection if none selected
      if (!value && data.length > 0) {
        onChange(data[0].id);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load connections");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchConnections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnectClick = () => {
    const returnUrl = typeof window !== "undefined" ? window.location.href : "/";
    const startUrl = `/api/oauth/${provider}/start?returnUrl=${encodeURIComponent(returnUrl)}`;
    window.location.href = startUrl;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">Connected {provider}</div>
        <Button variant="secondary" size="sm" onClick={handleConnectClick} className="gap-1">
          <LogIn size={14} /> Connect {provider}
        </Button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 size={14} className="animate-spin" /> Loading connections...
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      {!loading && connections.length === 0 && !error && (
        <p className="text-xs text-muted-foreground">No {provider} account connected yet.</p>
      )}

      {connections.length > 0 && (
        <select
          className="w-full rounded border px-2 py-1 text-sm"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select a connection</option>
          {connections.map((conn) => (
            <option key={conn.id} value={conn.id}>
              {conn.email || conn.id}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

export default ConnectionPicker;
