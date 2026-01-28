"use client";

import { useEffect, useState } from "react";

interface Form {
  id: string;
  name?: string;
  title?: string;
  description?: string;
}

export function GoogleFormPicker({
  connectionId,
  value,
  onChange,
}: {
  connectionId?: string;
  value?: string;
  onChange: (formId: string) => void;
}) {
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function extractFormId(input: string): string {
    // If user pasted full URL, try to extract ID between /d/ and next slash
    try {
      if (input.startsWith("http")) {
        const u = new URL(input);
        // Accept docs.google.com/forms and drive.google.com links
        const parts = u.pathname.split("/").filter(Boolean);
        const dIndex = parts.indexOf("d");
        if (dIndex !== -1 && parts.length > dIndex + 1) {
          return parts[dIndex + 1];
        }
      }
    } catch {}
    return input.trim();
  }

  useEffect(() => {
    if (!connectionId) {
      return;
    }

    const loadForms = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/integrations/google/forms?connectionId=${connectionId}`);
        const json = await res.json();
        
        if (res.status !== 200) {
          if (json?.error === "INSUFFICIENT_GOOGLE_SCOPES") {
            setError(
              "Insufficient Google permissions. Please reconnect Google with Drive + Forms access."
            );
          } else {
            setError("Failed to load forms. Please try reconnecting Google.");
          }
          setForms([]);
        } else {
          setForms(json || []);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to load forms";
        setError(errorMessage);
        setForms([]);
      } finally {
        setLoading(false);
      }
    };

    loadForms();
  }, [connectionId]);

  if (!connectionId) {
    return (
      <div className="rounded border border-amber-200 bg-amber-50 p-2 text-sm text-amber-700">
        Connect a Google account first to select a form
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded border border-gray-200 bg-gray-50 p-2 text-sm text-gray-500">
        Loading forms...
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <div className="font-semibold">Error loading forms:</div>
          <div className="mt-1">{error}</div>
          {error.includes("API") && (
            <div className="mt-2 text-xs">
              Enable required APIs in Google Cloud Console, then reconnect your Google account.
            </div>
          )}
        </div>
        <div className="rounded border border-gray-200 bg-white p-3">
          <label className="mb-1 block text-xs font-medium text-gray-700">
            Or enter Form ID manually:
          </label>
          <input
            type="text"
            value={value || ""}
            onChange={(e) => onChange(extractFormId(e.target.value))}
            placeholder="1FAIpQLSe... (from form URL)"
            className="w-full rounded border px-2 py-2 text-sm"
          />
          <div className="mt-1 text-xs text-gray-500">
            You can paste the full Google Form link; we&apos;ll extract the ID.
          </div>
        </div>
      </div>
    );
  }

  if (forms.length === 0) {
    return (
      <div className="space-y-2">
        <div className="rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">
          No forms found in your Google Drive. Create a Google Form first.
        </div>
        <div className="rounded border border-gray-200 bg-white p-3">
          <label className="mb-1 block text-xs font-medium text-gray-700">
            Or enter Form ID manually:
          </label>
          <input
            type="text"
            value={value || ""}
            onChange={(e) => onChange(extractFormId(e.target.value))}
            placeholder="1FAIpQLSe... (from form URL)"
            className="w-full rounded border px-2 py-2 text-sm"
          />
          <div className="mt-1 text-xs text-gray-500">
            You can paste the full Google Form link; we&apos;ll extract the ID.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border px-2 py-2 text-sm"
      >
        <option value="">Select a form...</option>
        {forms.map((form) => (
          <option key={form.id} value={form.id}>
            {form.name || form.title || form.id}
          </option>
        ))}
      </select>
      <div className="rounded border border-gray-200 bg-white p-3">
        <label className="mb-1 block text-xs font-medium text-gray-700">
          Or paste Google Form URL or ID:
        </label>
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(extractFormId(e.target.value))}
          placeholder="https://docs.google.com/forms/d/1FAIpQLSe.../edit or 1FAIpQLSe..."
          className="w-full rounded border px-2 py-2 text-sm"
        />
        <div className="mt-1 text-xs text-gray-500">
          We will extract the ID automatically from the link.
        </div>
      </div>
    </div>
  );
}
