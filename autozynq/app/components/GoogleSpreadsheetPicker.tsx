"use client";

import { useEffect, useState } from "react";

interface Spreadsheet {
  id: string;
  name: string;
  modifiedTime?: string;
}

interface GoogleSpreadsheetPickerProps {
  connectionId: string;
  value?: string; // spreadsheetId
  onChange: (spreadsheetId: string, spreadsheetName: string) => void;
}

export function GoogleSpreadsheetPicker({
  connectionId,
  value,
  onChange,
}: GoogleSpreadsheetPickerProps) {
  const [spreadsheets, setSpreadsheets] = useState<Spreadsheet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!connectionId) {
      setSpreadsheets([]);
      return;
    }

    const fetchSpreadsheets = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = `/api/integrations/google-sheets/spreadsheets?connectionId=${connectionId}`;
        console.log("[GoogleSpreadsheetPicker] Fetching from:", url);
        const res = await fetch(url);
        
        console.log("[GoogleSpreadsheetPicker] Response status:", res.status, res.statusText);
        const responseText = await res.text();
        console.log("[GoogleSpreadsheetPicker] Response body:", responseText);
        
        let data: any = {};
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          console.error("[GoogleSpreadsheetPicker] Failed to parse JSON:", e);
        }

        if (!res.ok) {
          const errorMsg = data.error || data.details || `HTTP ${res.status}: ${res.statusText}`;
          console.error("[GoogleSpreadsheetPicker] API error:", { status: res.status, statusText: res.statusText, error: errorMsg, data, responseText });
          throw new Error(errorMsg);
        }

        if (!data.spreadsheets || !Array.isArray(data.spreadsheets)) {
          console.error("[GoogleSpreadsheetPicker] Invalid response structure:", data);
          throw new Error("Invalid spreadsheets data returned from API");
        }

        console.log("[GoogleSpreadsheetPicker] Successfully fetched", data.spreadsheets.length, "spreadsheets");
        setSpreadsheets(data.spreadsheets);
      } catch (err: any) {
        console.error("[GoogleSpreadsheetPicker] Error fetching spreadsheets:", err);
        setError(err.message);
        setSpreadsheets([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSpreadsheets();
  }, [connectionId]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const spreadsheetId = e.target.value;
    const spreadsheet = spreadsheets.find((s) => s.id === spreadsheetId);
    if (spreadsheet) {
      onChange(spreadsheetId, spreadsheet.name);
    }
  };

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground">
        Loading spreadsheets...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-600">
        Error: {error}
      </div>
    );
  }

  if (!connectionId) {
    return (
      <div className="text-xs text-blue-600 p-2 bg-blue-50 rounded border border-blue-200">
        Please select or connect a Google account above first
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-xs text-red-600 p-2 bg-red-50 rounded border border-red-200">
        Error loading spreadsheets: {error}
      </div>
    );
  }

  if (spreadsheets.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No spreadsheets found in this account
      </div>
    );
  }

  return (
    <select
      value={value || ""}
      onChange={handleChange}
      className="w-full rounded border px-2 py-1 text-sm"
    >
      <option value="">Select a spreadsheet</option>
      {spreadsheets.map((sheet) => (
        <option key={sheet.id} value={sheet.id}>
          {sheet.name}
        </option>
      ))}
    </select>
  );
}
