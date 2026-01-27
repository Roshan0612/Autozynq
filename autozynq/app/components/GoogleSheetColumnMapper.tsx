"use client";

import { useEffect, useState } from "react";

interface Column {
  name: string;
  index: number;
  letter: string;
}

interface GoogleSheetColumnMapperProps {
  connectionId: string;
  spreadsheetId: string;
  sheetName: string;
  values: Record<string, string>; // columnName → expression/value
  onChange: (values: Record<string, string>) => void;
}

export function GoogleSheetColumnMapper({
  connectionId,
  spreadsheetId,
  sheetName,
  values,
  onChange,
}: GoogleSheetColumnMapperProps) {
  const [columns, setColumns] = useState<Column[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!connectionId || !spreadsheetId || !sheetName) {
      setColumns([]);
      return;
    }

    const fetchColumns = async () => {
      setLoading(true);
      setError(null);
      try {
        const encodedSheetName = encodeURIComponent(sheetName);
        const url = `/api/integrations/google-sheets/columns/${spreadsheetId}/${encodedSheetName}?connectionId=${connectionId}`;
        console.log("[GoogleSheetColumnMapper] Fetching from:", url);
        const res = await fetch(url);
        
        console.log("[GoogleSheetColumnMapper] Response status:", res.status, res.statusText);
        const responseText = await res.text();
        console.log("[GoogleSheetColumnMapper] Response body:", responseText);
        
        let data: any = {};
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          console.error("[GoogleSheetColumnMapper] Failed to parse JSON:", e);
        }

        if (!res.ok) {
          const errorMsg = data.error || data.details || `HTTP ${res.status}: ${res.statusText}`;
          console.error("[GoogleSheetColumnMapper] API error:", { status: res.status, statusText: res.statusText, error: errorMsg, data, responseText });
          throw new Error(errorMsg);
        }

        if (!data.columns || !Array.isArray(data.columns)) {
          console.error("[GoogleSheetColumnMapper] Invalid response structure:", data);
          throw new Error("Invalid columns data returned from API");
        }

        console.log("[GoogleSheetColumnMapper] Successfully fetched", data.columns.length, "columns");
        setColumns(data.columns);
      } catch (err: any) {
        console.error("[GoogleSheetColumnMapper] Error fetching columns:", err);
        setError(err.message);
        setColumns([]);
      } finally {
        setLoading(false);
      }
    };

    fetchColumns();
  }, [connectionId, spreadsheetId, sheetName]);

  const handleColumnChange = (columnName: string, value: string) => {
    onChange({
      ...values,
      [columnName]: value,
    });
  };

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground">
        Loading columns...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-xs text-red-600 p-2 bg-red-50 rounded border border-red-200">
        Error loading columns: {error}
      </div>
    );
  }

  if (!connectionId || !spreadsheetId || !sheetName) {
    return (
      <div className="text-xs text-blue-600 p-2 bg-blue-50 rounded border border-blue-200">
        {!connectionId
          ? "Please select a Google connection first"
          : !spreadsheetId
          ? "Please select a spreadsheet first"
          : "Please select a sheet first"}
      </div>
    );
  }

  if (columns.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No columns found (header row may be empty)
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Map values to columns. Use {`{{steps.nodeId.field}}`} to reference previous outputs.
      </p>
      {columns.map((column) => (
        <div key={column.index} className="space-y-1">
          <p className="font-mono text-xs text-muted-foreground">
            {column.name} <span className="opacity-60">({column.letter})</span>
          </p>
          <input
            value={values[column.name] || ""}
            onChange={(e) => handleColumnChange(column.name, e.target.value)}
            placeholder={`{{steps.trigger1.${column.name.toLowerCase()}}}`}
            className="w-full rounded border px-2 py-1 text-sm font-mono"
          />
        </div>
      ))}
    </div>
  );
}
