"use client";

import { useEffect, useState } from "react";

interface Sheet {
  sheetId: number;
  title: string;
  index: number;
}

interface GoogleSheetPickerProps {
  connectionId: string;
  spreadsheetId: string;
  value?: string; // sheetName
  onChange: (sheetName: string, sheetId: number) => void;
}

export function GoogleSheetPicker({
  connectionId,
  spreadsheetId,
  value,
  onChange,
}: GoogleSheetPickerProps) {
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!connectionId || !spreadsheetId) {
      setSheets([]);
      return;
    }

    const fetchSheets = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = `/api/integrations/google-sheets/sheets/${spreadsheetId}?connectionId=${connectionId}`;
        console.log("[GoogleSheetPicker] Fetching from:", url);
        const res = await fetch(url);
        
        console.log("[GoogleSheetPicker] Response status:", res.status, res.statusText);
        const responseText = await res.text();
        console.log("[GoogleSheetPicker] Response body:", responseText);
        
        let data: Record<string, unknown> = {};
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          console.error("[GoogleSheetPicker] Failed to parse JSON:", e);
        }

        if (!res.ok) {
          const fallback = responseText ? "Unknown API error" : "No response body received";
          const errorMsg = String(data.error || data.details || `HTTP ${res.status}: ${res.statusText}` || fallback);
          console.error("[GoogleSheetPicker] API error:", {
            status: res.status,
            statusText: res.statusText,
            error: errorMsg,
            data,
            responseText,
            connectionId,
            spreadsheetId,
          });
          throw new Error(errorMsg);
        }

        if (!data.sheets || !Array.isArray(data.sheets)) {
          console.error("[GoogleSheetPicker] Invalid response structure:", data);
          throw new Error("Invalid sheets data returned from API");
        }

        console.log("[GoogleSheetPicker] Successfully fetched", (data.sheets as Sheet[]).length, "sheets");
        setSheets(data.sheets as Sheet[]);
      } catch (err: unknown) {
        const error = err as Record<string, unknown>;
        console.error("[GoogleSheetPicker] Error fetching sheets:", err);
        console.error("[GoogleSheetPicker] Error stack:", (error as Record<string, unknown>).stack);
        setError((error.message as string) || "Unknown error occurred");
        setSheets([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSheets();
  }, [connectionId, spreadsheetId]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sheetName = e.target.value;
    const sheet = sheets.find((s) => s.title === sheetName);
    if (sheet) {
      onChange(sheetName, sheet.sheetId);
    }
  };

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground">
        Loading sheets...
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

  if (!connectionId || !spreadsheetId) {
    return (
      <div className="text-xs text-blue-600 p-2 bg-blue-50 rounded border border-blue-200">
        {!connectionId
          ? "Please select a Google connection first"
          : "Please select a spreadsheet first"}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-xs text-red-600 p-2 bg-red-50 rounded border border-red-200">
        Error loading sheets: {error}
      </div>
    );
  }

  if (sheets.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No sheets found in this spreadsheet
      </div>
    );
  }

  return (
    <select
      value={value || ""}
      onChange={handleChange}
      className="w-full rounded border px-2 py-1 text-sm"
    >
      <option value="">Select a sheet</option>
      {sheets.map((sheet) => (
        <option key={sheet.sheetId} value={sheet.title}>
          {sheet.title}
        </option>
      ))}
    </select>
  );
}
