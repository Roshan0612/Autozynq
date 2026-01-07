import React from "react";

export function BaseNode({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "relative",
        background: "#ffffff",
        border: "2px solid #3b82f6",
        padding: "12px",
        color: "#111827",
        fontSize: "14px",
        fontWeight: 600,
        minWidth: "140px",
        minHeight: "70px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "6px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
      }}
    >
      {children}
    </div>
  );
}

export function BaseNodeContent({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
      {children}
    </div>
  );
}
