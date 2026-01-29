"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Connection,
  Controls,
  Edge as FlowEdge,
  Handle,
  Node as FlowNode,
  Position,
  ReactFlowProvider,
  ReactFlowInstance,
  MarkerType,
  BaseEdge,
  getStraightPath,
  EdgeProps,
  useNodesState,
  useEdgesState,
  addEdge,
} from "reactflow";
import "reactflow/dist/style.css";
import "@/app/workflow-nodes.css";
import { nanoid } from "nanoid";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConnectionPicker } from "@/components/ConnectionPicker";
import { GoogleFormPicker } from "@/components/GoogleFormPicker";
import { GoogleSpreadsheetPicker } from "@/app/components/GoogleSpreadsheetPicker";
import { GoogleSheetPicker } from "@/app/components/GoogleSheetPicker";
import { GoogleSheetColumnMapper } from "@/app/components/GoogleSheetColumnMapper";
import { CreateFolderConfig } from "@/app/components/nodes/google_drive/CreateFolderConfig";
import { SetSharingPreferenceConfig } from "@/app/components/nodes/google_drive/SetSharingPreferenceConfig";
import { WorkflowDefinition } from "@/lib/workflow/schema";
import { WorkflowStatus } from "@prisma/client";

// Custom node component - professional dark theme
function CustomNode({ data }: { data: Record<string, unknown> }) {
  const appIcon = data.appIcon as React.ReactNode | null | undefined;

  return (
    <div
      className="relative w-[260px] min-h-[80px] rounded-xl border border-blue-500/60 bg-gradient-to-b from-slate-900 to-slate-950 p-3 shadow-[0_0_24px_rgba(59,130,246,0.25)]"
    >
      <Handle
        type="target"
        position={Position.Top}
        isConnectable
        style={{ background: "#3b82f6", width: 12, height: 12, border: "2px solid #0f172a", zIndex: 20 }}
      />
      
      <div className="flex w-full items-start gap-3">
        <div className="flex h-12 w-12 min-w-[48px] items-center justify-center rounded-lg border border-blue-500/50 bg-slate-900">
          {appIcon || null}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-slate-100">
            {String(data.label || "Node")}
          </div>
          <div className="text-xs text-slate-400">
            {String(data.nodeType)}
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable
        style={{ background: "#3b82f6", width: 12, height: 12, border: "2px solid #0f172a", zIndex: 20 }}
      />
    </div>
  );
}

// Professional edge component
function CustomEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  style,
}: EdgeProps) {
  const [edgePath] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  return (
    <BaseEdge
      path={edgePath}
      markerEnd={markerEnd}
      style={{
        ...style,
        stroke: "#4f46e5",
        strokeWidth: 2.5,
        opacity: 0.8,
      }}
    />
  );
}

const nodeTypes = {
  custom: CustomNode,
};

const edgeTypes = {
  custom: CustomEdge,
};

interface WorkflowBuilderClientProps {
  workflowId: string;
  workflowName: string;
  initialDefinition: WorkflowDefinition;
  initialStatus: WorkflowStatus;
}

type NodeCategory = "trigger" | "action" | "logic";

type BuilderNode = {
  id: string;
  nodeType: string;
  category: NodeCategory;
  config: Record<string, unknown>;
  position: { x: number; y: number };
};

type BuilderEdge = {
  id: string;
  from: string;
  to: string;
  condition?: string;
};

type WorkflowState = {
  nodes: BuilderNode[];
  edges: BuilderEdge[];
};

type NodeTemplate = {
  key: string;
  label: string;
  category: NodeCategory;
  nodeType: string;
  defaultConfig: Record<string, unknown>;
};

const NODE_LIBRARY: NodeTemplate[] = [
  {
    key: "webhook",
    label: "Webhook Trigger",
    category: "trigger",
    nodeType: "trigger.webhook.basic",
    defaultConfig: { description: "" },
  },
  {
    key: "manual",
    label: "Manual Trigger",
    category: "trigger",
    nodeType: "trigger.manual",
    defaultConfig: { payload: {} },
  },
  {
    key: "http",
    label: "HTTP Request",
    category: "action",
    nodeType: "action.http.request",
    defaultConfig: {
      url: "https://api.example.com",
      method: "GET",
      headers: {},
      body: undefined,
    },
  },
  {
    key: "log",
    label: "Log / Debug",
    category: "action",
    nodeType: "action.log.debug",
    defaultConfig: { message: "", level: "info" },
  },
  {
    key: "ai-generate",
    label: "AI Generate Text",
    category: "action",
    nodeType: "ai.action.generateText",
    defaultConfig: {
      provider: "groq",
      model: "llama-3.3-70b-versatile",
      userPrompt: "",
      temperature: 0.7,
      maxTokens: 500,
    },
  },
  {
    key: "ai-generate-email",
    label: "AI Generate Email",
    category: "action",
    nodeType: "ai.action.generateEmail",
    defaultConfig: {
      instructions: "Write a short, friendly acknowledgement email.",
    },
  },
  {
    key: "if",
    label: "If / Condition",
    category: "logic",
    nodeType: "logic.condition",
    defaultConfig: { operator: "equals", value: "" },
  },
  // Google Forms
  {
    key: "gf-new-response",
    label: "Google Forms – New Response",
    category: "trigger",
    nodeType: "google_forms.trigger.newResponse",
    defaultConfig: { formId: "", includeAttachments: false },
  },
  {
    key: "gf-get-form",
    label: "Google Forms – Get Form",
    category: "action",
    nodeType: "google_forms.action.getForm",
    defaultConfig: { connectionId: "stub-conn", formId: "form_123" },
  },
  {
    key: "gf-get-response",
    label: "Google Forms – Get Response",
    category: "action",
    nodeType: "google_forms.action.getResponse",
    defaultConfig: { connectionId: "stub-conn", formId: "form_123", responseId: "resp_1" },
  },
  {
    key: "gf-list-responses",
    label: "Google Forms – List Responses",
    category: "action",
    nodeType: "google_forms.action.listResponses",
    defaultConfig: { connectionId: "stub-conn", formId: "form_123", limit: 2, since: undefined },
  },
  // Google Sheets
  {
    key: "gs-watch-rows",
    label: "Google Sheets – Watch New Rows",
    category: "trigger",
    nodeType: "google_sheets.trigger.watchNewRows",
    defaultConfig: { connectionId: "", spreadsheetId: "", spreadsheetName: "", sheetName: "", fromRow: 2, limit: undefined, startMode: "from_now" },
  },
  {
    key: "gs-get-row",
    label: "Google Sheets – Get Row",
    category: "action",
    nodeType: "google_sheets.action.getRow",
    defaultConfig: { connectionId: "", spreadsheetId: "", spreadsheetName: "", sheetName: "", rowNumber: 2 },
  },
  {
    key: "gs-search-rows",
    label: "Google Sheets – Search Rows",
    category: "action",
    nodeType: "google_sheets.action.searchRows",
    defaultConfig: { connectionId: "", spreadsheetId: "", spreadsheetName: "", sheetName: "", searchValue: "", searchColumn: "ALL", limit: 10 },
  },
  {
    key: "gs-update-row",
    label: "Google Sheets – Update Row",
    category: "action",
    nodeType: "google_sheets.action.updateRow",
    defaultConfig: { connectionId: "", spreadsheetId: "", spreadsheetName: "", sheetName: "", rowNumber: 2, values: {} },
  },
  {
    key: "gs-create-row",
    label: "Google Sheets – Create Row",
    category: "action",
    nodeType: "google_sheets.action.createRow",
    defaultConfig: { connectionId: "", spreadsheetId: "", spreadsheetName: "", sheetName: "", columnValues: {} },
  },
  {
    key: "gmail-send-email",
    label: "Gmail – Send Email",
    category: "action",
    nodeType: "gmail.action.sendEmail",
    defaultConfig: {
      to: "{{answers.Email}}",
      cc: "",
      subject: "{{subject}}",
      bodyHtml: "{{body}}",
    },
  },
  {
    key: "gd-create-folder",
    label: "Google Drive – Create Folder",
    category: "action",
    nodeType: "google_drive.action.createFolder",
    defaultConfig: {
      connectionId: "",
      parentFolderId: "root",
      customParentFolderId: "",
      folderName: "{{folderName}}",
    },
  },
  {
    key: "gd-set-sharing",
    label: "Google Drive – Set Sharing Preference",
    category: "action",
    nodeType: "google_drive.action.setSharingPreference",
    defaultConfig: {
      connectionId: "",
      fileId: "{{fileId}}",
      role: "viewer",
      scope: "anyone",
      email: "",
      allowDiscovery: false,
    },
  },
];

const templateByType = NODE_LIBRARY.reduce<Record<string, NodeTemplate>>((acc, tmpl) => {
  acc[tmpl.nodeType] = tmpl;
  return acc;
}, {});

function inferCategory(nodeType?: string): NodeCategory {
  if (!nodeType) return "action";
  return templateByType[nodeType]?.category || (nodeType.includes("logic") ? "logic" : "action");
}

function hydrateState(definition: WorkflowDefinition): WorkflowState {
  const positions = definition.ui?.positions || {};
  const nodes: BuilderNode[] = (definition.nodes || []).map((node, idx) => {
    const nodeAsRecord = node as Record<string, unknown>;
    const nodeType = String(nodeAsRecord.type || nodeAsRecord.nodeType || "");
    return {
      id: node.id,
      nodeType,
      category: inferCategory(nodeType),
      config: (node.config as Record<string, unknown>) ?? {},
      position:
        positions[node.id] || {
          x: 100 + (idx % 4) * 200,
          y: 80 + Math.floor(idx / 4) * 140,
        },
    };
  });

  const edges: BuilderEdge[] = (definition.edges || []).map((edge) => ({
    id: `edge_${edge.from}_${edge.to}_${Math.random().toString(36).substring(2, 11)}`,
    from: edge.from,
    to: edge.to,
    condition: edge.condition || undefined,
  }));

  return { nodes, edges };
}

function toReactFlowNodes(
  nodes: BuilderNode[],
  edges: BuilderEdge[],
  onAddNode?: (sourceNodeId?: string) => void
): FlowNode[] {
  return nodes.map((node) => ({
    id: node.id,
    position: node.position,
    data: {
      label: templateByType[node.nodeType]?.label || node.nodeType,
      category: node.category,
      onAddNode: () => onAddNode?.(node.id),
      canAdd: !edges.some((e) => e.from === node.id),
      appIcon: getAppIcon(node.nodeType),
    },
    sourcePosition: Position.Bottom,
    targetPosition: Position.Top,
    type: "custom",
  }));
}

function toReactFlowEdges(edges: BuilderEdge[]): FlowEdge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.from,
    target: edge.to,
    sourceHandle: 'b',
    targetHandle: 't',
    type: 'smoothstep',
    label: edge.condition || undefined,
    data: { condition: edge.condition },
    animated: false,
    style: { stroke: "#334155", strokeWidth: 2.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#334155", width: 20, height: 20 },
  }));
}

function getAppIcon(nodeType: string): React.ReactNode | null {
  if (nodeType.startsWith("google_sheets")) {
    return (
      <svg width="100%" height="100%" viewBox="0 0 24 24" role="img" aria-label="Google Sheets" style={{ display: "block" }}>
        <rect x="5" y="3" width="14" height="18" rx="2" ry="2" fill="#0f9d58" stroke="#0f9d58" />
        <path d="M8 8h8M8 12h8M8 16h4" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (nodeType.startsWith("google_forms")) {
    return (
      <svg width="100%" height="100%" viewBox="0 0 24 24" role="img" aria-label="Google Forms" style={{ display: "block" }}>
        <rect x="5" y="3" width="14" height="18" rx="2" ry="2" fill="#673ab7" stroke="#673ab7" />
        <path d="M9 9h6M9 12h6M9 15h4" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (nodeType.startsWith("google_drive")) {
    return (
      <svg width="100%" height="100%" viewBox="0 0 24 24" role="img" aria-label="Google Drive" style={{ display: "block" }}>
        <polygon points="9,3 15,3 22,15 16,15" fill="#0f9d58" />
        <polygon points="2,15 9,3 16,15 9,21" fill="#4285f4" />
        <polygon points="2,15 9,21 22,15 15,3" fill="#f4b400" opacity="0.9" />
      </svg>
    );
  }

  if (nodeType.startsWith("gmail")) {
    return (
      <svg width="100%" height="100%" viewBox="0 0 24 24" role="img" aria-label="Gmail" style={{ display: "block" }}>
        <rect x="4" y="5" width="16" height="14" rx="2" ry="2" fill="#ffffff" stroke="#d93025" />
        <path d="M5 7l7 5 7-5" stroke="#d93025" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (nodeType.startsWith("email")) {
    return (
      <svg width="100%" height="100%" viewBox="0 0 24 24" role="img" aria-label="Email" style={{ display: "block" }}>
        <rect x="4" y="6" width="16" height="12" rx="2" ry="2" fill="#ffffff" stroke="#64748b" />
        <path d="M5 8l7 5 7-5" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (nodeType.startsWith("ai.")) {
    return (
      <svg width="100%" height="100%" viewBox="0 0 24 24" role="img" aria-label="AI" style={{ display: "block" }}>
        <circle cx="12" cy="12" r="9" fill="#1a73e8" stroke="#1a73e8" />
        <text x="12" y="15" textAnchor="middle" fontSize="9" fill="#ffffff" fontWeight="700">AI</text>
      </svg>
    );
  }

  return null;
}

function serializeDefinition(workflowState: WorkflowState): WorkflowDefinition {
  const normalizeFormId = (input?: string) => {
    if (!input) return "";
    if (!input.startsWith("http")) return input.trim();
    const match = input.match(/\/forms\/d\/e\/([^/]+)/);
    if (match?.[1]) return match[1];
    const url = new URL(input);
    const pathParts = url.pathname.split("/").filter(Boolean);
    return pathParts[pathParts.length - 1] || input.trim();
  };

  const normalizedNodes = workflowState.nodes.map((node) => {
    let config = { ...(node.config ?? {}) } as Record<string, unknown>;

    if (node.nodeType === "google_forms.trigger.newResponse") {
      config = {
        connectionId: config.connectionId ?? "",
        formId: normalizeFormId(config.formId as string | undefined),
        includeAttachments: Boolean(config.includeAttachments),
        conditions: config.conditions,
      };
    }

    if (node.nodeType === "gmail.action.sendEmail") {
      const bodyHtml = config.bodyHtml ?? config.body ?? "";
      config = {
        connectionId: config.connectionId ?? "",
        to: config.to ?? "",
        cc: config.cc ?? "",
        bcc: config.bcc ?? "",
        subject: config.subject ?? "",
        bodyHtml,
      };
    }

    if (node.nodeType === "ai.action.generateText") {
      const userPrompt = config.userPrompt ?? config.prompt ?? "";
      const { prompt, ...rest } = config;
      config = { ...rest, userPrompt };
    }

    return {
      id: node.id,
      type: node.nodeType,
      config,
    };
  });

  return {
    nodes: normalizedNodes,
    edges: workflowState.edges.map((edge) => ({
      from: edge.from,
      to: edge.to,
      ...(edge.condition ? { condition: edge.condition } : {}),
    })),
    ui: {
      positions: workflowState.nodes.reduce<Record<string, { x: number; y: number }>>((acc, node) => {
        acc[node.id] = node.position;
        return acc;
      }, {}),
    },
  } satisfies WorkflowDefinition;
}

function NodeConfigForm({
  node,
  onChange,
}: {
  node: BuilderNode;
  onChange: (config: Record<string, unknown>) => void;
}) {
  // Template lookup available for future use
  // const template = templateByType[node.nodeType];

  switch (node.nodeType) {
    case "trigger.webhook.basic":
      return (
        <div className="space-y-3">
          <p className="font-mono text-xs text-muted-foreground">Description</p>
          <input
            value={String(node.config.description || "")}
            onChange={(e) => onChange({ ...node.config, description: e.target.value })}
            placeholder="Optional description"
            className="w-full rounded border px-2 py-1 text-sm"
          />
        </div>
      );
    case "google_forms.trigger.newResponse":
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Google Connection</p>
            <ConnectionPicker
              provider="google"
              value={String(node.config.connectionId || "")}
              onChange={(id) => onChange({ ...node.config, connectionId: id })}
            />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Select Form</p>
            <GoogleFormPicker
              connectionId={String(node.config.connectionId || "")}
              value={String(node.config.formId || "")}
              onChange={(formId: string) => onChange({ ...node.config, formId })}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            💡 Reference form answers in next nodes using: {`{{steps.${node.id}.answers.fieldName}}`}
          </p>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={Boolean(node.config.includeAttachments)}
              onChange={(e) => onChange({ ...node.config, includeAttachments: e.target.checked })}
            />
            Include attachments
          </label>
        </div>
      );
    case "ai.action.generateEmail":
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Instructions (optional)</p>
            <textarea
              value={String(node.config.instructions || "")}
              onChange={(e) => onChange({ ...node.config, instructions: e.target.value })}
              placeholder="Write a short, friendly acknowledgement email."
              className="w-full rounded border px-2 py-2 text-sm font-mono"
              rows={5}
            />
          </div>
          <p className="text-xs text-muted-foreground">This node outputs {"{{subject}}"} and {"{{body}}"}.</p>
        </div>
      );
    case "google_forms.action.getForm":
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Connection ID</p>
            <input
              value={String(node.config.connectionId || "")}
              onChange={(e) => onChange({ ...node.config, connectionId: e.target.value })}
              placeholder="stub-conn"
              className="w-full rounded border px-2 py-1 text-sm"
            />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Form ID</p>
            <input
              value={String(node.config.formId || "")}
              onChange={(e) => onChange({ ...node.config, formId: e.target.value })}
              placeholder="form_123"
              className="w-full rounded border px-2 py-1 text-sm"
            />
          </div>
        </div>
      );
    case "google_forms.action.getResponse":
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Connection ID</p>
            <input
              value={String(node.config.connectionId || "")}
              onChange={(e) => onChange({ ...node.config, connectionId: e.target.value })}
              placeholder="stub-conn"
              className="w-full rounded border px-2 py-1 text-sm"
            />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Form ID</p>
            <input
              value={String(node.config.formId || "")}
              onChange={(e) => onChange({ ...node.config, formId: e.target.value })}
              placeholder="form_123"
              className="w-full rounded border px-2 py-1 text-sm"
            />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Response ID</p>
            <input
              value={String(node.config.responseId || "")}
              onChange={(e) => onChange({ ...node.config, responseId: e.target.value })}
              placeholder="resp_1"
              className="w-full rounded border px-2 py-1 text-sm"
            />
          </div>
        </div>
      );
    case "google_forms.action.listResponses":
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Connection ID</p>
            <input
              value={String(node.config.connectionId || "")}
              onChange={(e) => onChange({ ...node.config, connectionId: e.target.value })}
              placeholder="stub-conn"
              className="w-full rounded border px-2 py-1 text-sm"
            />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Form ID</p>
            <input
              value={String(node.config.formId || "")}
              onChange={(e) => onChange({ ...node.config, formId: e.target.value })}
              placeholder="form_123"
              className="w-full rounded border px-2 py-1 text-sm"
            />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Limit (optional)</p>
            <input
              type="number"
              value={String(node.config.limit ?? "")}
              onChange={(e) => onChange({ ...node.config, limit: e.target.value ? parseInt(e.target.value) : undefined })}
              placeholder="2"
              className="w-full rounded border px-2 py-1 text-sm"
            />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Since (ISO, optional)</p>
            <input
              value={String(node.config.since || "")}
              onChange={(e) => onChange({ ...node.config, since: e.target.value || undefined })}
              placeholder="2024-01-01T00:00:00.000Z"
              className="w-full rounded border px-2 py-1 text-sm"
            />
          </div>
        </div>
      );
    case "trigger.manual":
      return (
        <div className="space-y-2">
          <p className="font-mono text-xs text-muted-foreground">Payload (JSON)</p>
          <textarea
            value={JSON.stringify(node.config.payload ?? {}, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value || "{}");
                onChange({ ...node.config, payload: parsed });
              } catch {
                onChange({ ...node.config, payload: e.target.value });
              }
            }}
            className="w-full rounded border px-2 py-2 font-mono text-xs"
            rows={6}
          />
        </div>
      );
    case "action.http.request":
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">URL</p>
            <input
              value={String(node.config.url || "")}
              onChange={(e) => onChange({ ...node.config, url: e.target.value })}
              placeholder="https://api.example.com"
              className="w-full rounded border px-2 py-1 text-sm"
            />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Method</p>
            <select
              className="w-full rounded border px-2 py-1 text-sm"
              value={String(node.config.method || "GET")}
              onChange={(e) => onChange({ ...node.config, method: e.target.value })}
            >
              {(["GET", "POST", "PUT", "PATCH", "DELETE"] as const).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Headers (JSON)</p>
            <textarea
              className="w-full rounded border px-2 py-2 font-mono text-xs"
              rows={4}
              value={JSON.stringify(node.config.headers ?? {}, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value || "{}");
                  onChange({ ...node.config, headers: parsed });
                } catch {
                  onChange({ ...node.config, headers: e.target.value });
                }
              }}
            />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Body (JSON)</p>
            <textarea
              className="w-full rounded border px-2 py-2 font-mono text-xs"
              rows={4}
              value={
                node.config.body === undefined
                  ? ""
                  : typeof node.config.body === "string"
                  ? node.config.body
                  : JSON.stringify(node.config.body, null, 2)
              }
              onChange={(e) => {
                const raw = e.target.value;
                if (!raw) return onChange({ ...node.config, body: undefined });
                try {
                  const parsed = JSON.parse(raw);
                  onChange({ ...node.config, body: parsed });
                } catch {
                  onChange({ ...node.config, body: raw });
                }
              }}
              placeholder='{"key": "value"}'
            />
          </div>
        </div>
      );
    case "action.log.debug":
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Message</p>
            <input
              value={String(node.config.message || "")}
              onChange={(e) => onChange({ ...node.config, message: e.target.value })}
              placeholder="Debug message"
              className="w-full rounded border px-2 py-1 text-sm"
            />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Level</p>
            <select
              className="w-full rounded border px-2 py-1 text-sm"
              value={String(node.config.level || "info")}
              onChange={(e) => onChange({ ...node.config, level: e.target.value })}
            >
              <option value="info">info</option>
              <option value="warn">warn</option>
              <option value="error">error</option>
            </select>
          </div>
        </div>
      );
    case "gmail.action.sendEmail":
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Gmail Connection</p>
            <ConnectionPicker
              provider="google"
              value={String(node.config.connectionId || "")}
              onChange={(id) => onChange({ ...node.config, connectionId: id })}
            />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">To</p>
            <input
              value={String(node.config.to || "")}
              onChange={(e) => onChange({ ...node.config, to: e.target.value })}
              placeholder="{{steps.trigger1.email}} or someone@example.com"
              className="w-full rounded border px-2 py-1 text-sm"
            />
            <p className="text-xs text-muted-foreground">Use {`{{steps.nodeId.field}}`} to reference previous outputs</p>
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">CC (optional)</p>
            <input
              value={String(node.config.cc || "")}
              onChange={(e) => onChange({ ...node.config, cc: e.target.value })}
              placeholder="{{steps.trigger1.cc}} or team@example.com"
              className="w-full rounded border px-2 py-1 text-sm"
            />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">BCC (optional)</p>
            <input
              value={String(node.config.bcc || "")}
              onChange={(e) => onChange({ ...node.config, bcc: e.target.value })}
              placeholder="archive@example.com"
              className="w-full rounded border px-2 py-1 text-sm"
            />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Subject</p>
            <input
              value={String(node.config.subject || "")}
              onChange={(e) => onChange({ ...node.config, subject: e.target.value })}
              placeholder="Thank you {{steps.trigger1.name}}!"
              className="w-full rounded border px-2 py-1 text-sm"
            />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Body HTML</p>
            <textarea
              value={String(node.config.bodyHtml || "")}
              onChange={(e) => onChange({ ...node.config, bodyHtml: e.target.value })}
              placeholder="<p>Hi {{steps.trigger1.name}},</p><p>{{steps.ai1.body}}</p>"
              className="w-full rounded border px-2 py-2 text-sm font-mono"
              rows={6}
            />
            <p className="text-xs text-muted-foreground">Supports {`{{steps.nodeId.field}}`} to insert previous outputs</p>
          </div>
        </div>
      );
    case "ai.action.generateText":
      const provider = String(node.config.provider || "groq");
      const groqModels = [
        { value: "llama-3.3-70b-versatile", label: "Llama 3.3 70B (Fastest)" },
        { value: "llama-3.1-70b-versatile", label: "Llama 3.1 70B" },
        { value: "mixtral-8x7b-32768", label: "Mixtral 8x7B" },
        { value: "gemma2-9b-it", label: "Gemma 2 9B" },
      ];
      const geminiModels = [
        { value: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite (Free Tier)" },
        { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
        { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
        { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
      ];
      const openaiModels = [
        { value: "gpt-4o-mini", label: "GPT-4o Mini (Fastest)" },
        { value: "gpt-4o", label: "GPT-4o" },
        { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
        { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
      ];
      const currentModels = provider === "groq" ? groqModels : provider === "gemini" ? geminiModels : openaiModels;
      const defaultModel = provider === "groq" ? "llama-3.3-70b-versatile" : provider === "gemini" ? "gemini-2.0-flash-lite" : "gpt-4o-mini";

      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Provider</p>
            <select
              className="w-full rounded border px-2 py-1 text-sm"
              value={provider}
              onChange={(e) => {
                const newProvider = e.target.value;
                const newModel = newProvider === "groq" ? "llama-3.3-70b-versatile" : newProvider === "gemini" ? "gemini-2.0-flash-lite" : "gpt-4o-mini";
                onChange({ ...node.config, provider: newProvider, model: newModel });
              }}
            >
              <option value="groq">Groq (Fast LLMs)</option>
              <option value="gemini">Google Gemini</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Model</p>
            <select
              className="w-full rounded border px-2 py-1 text-sm"
              value={String(node.config.model || defaultModel)}
              onChange={(e) => onChange({ ...node.config, model: e.target.value })}
            >
              {currentModels.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">System Prompt (optional)</p>
            <textarea
              value={String(node.config.systemPrompt || "")}
              onChange={(e) => onChange({ ...node.config, systemPrompt: e.target.value })}
              placeholder="You are a helpful assistant..."
              className="w-full rounded border px-2 py-2 text-sm font-mono"
              rows={3}
            />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Prompt *</p>
            <textarea
              value={String(node.config.userPrompt || "")}
              onChange={(e) => onChange({ ...node.config, userPrompt: e.target.value })}
              placeholder="Generate a creative blog post title about..."
              className="w-full rounded border px-2 py-2 text-sm font-mono"
              rows={5}
            />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Temperature ({String(node.config.temperature ?? 0.7)})</p>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={Number(node.config.temperature ?? 0.7)}
              onChange={(e) => onChange({ ...node.config, temperature: parseFloat(e.target.value) })}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">Lower = more focused, Higher = more creative</p>
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Max Tokens</p>
            <input
              type="number"
              min="1"
              max="8000"
              value={Number(node.config.maxTokens ?? 500)}
              onChange={(e) => onChange({ ...node.config, maxTokens: parseInt(e.target.value) || 500 })}
              className="w-full rounded border px-2 py-1 text-sm"
            />
          </div>
        </div>
      );
    case "logic.condition":
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Operator</p>
            <select
              className="w-full rounded border px-2 py-1 text-sm"
              value={String(node.config.operator || "equals")}
              onChange={(e) => onChange({ ...node.config, operator: e.target.value })}
            >
              <option value="equals">equals</option>
              <option value="notEquals">notEquals</option>
              <option value="greaterThan">greaterThan</option>
              <option value="lessThan">lessThan</option>
              <option value="contains">contains</option>
            </select>
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Value</p>
            <input
              value={
                typeof node.config.value === "string"
                  ? node.config.value
                  : JSON.stringify(node.config.value ?? "")
              }
              onChange={(e) => {
                const raw = e.target.value;
                try {
                  onChange({ ...node.config, value: JSON.parse(raw) });
                } catch {
                  onChange({ ...node.config, value: raw });
                }
              }}
              placeholder="Comparison value"
              className="w-full rounded border px-2 py-1 text-sm"
            />
          </div>
        </div>
      );
    case "google_sheets.action.createRow":
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Google Account</p>
            <ConnectionPicker
              provider="google"
              value={String(node.config.connectionId || "")}
              onChange={(id) => onChange({ ...node.config, connectionId: id })}
            />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Spreadsheet</p>
            <GoogleSpreadsheetPicker
              connectionId={String(node.config.connectionId || "")}
              value={String(node.config.spreadsheetId || "")}
              onChange={(spreadsheetId: string, spreadsheetName: string) =>
                onChange({ ...node.config, spreadsheetId, spreadsheetName })
              }
            />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Sheet</p>
            <GoogleSheetPicker
              connectionId={String(node.config.connectionId || "")}
              spreadsheetId={String(node.config.spreadsheetId || "")}
              value={String(node.config.sheetName || "")}
              onChange={(sheetName: string) => onChange({ ...node.config, sheetName })}
            />
          </div>
          {String(node.config.connectionId) && String(node.config.spreadsheetId) && String(node.config.sheetName) && (
            <GoogleSheetColumnMapper
              connectionId={String(node.config.connectionId)}
              spreadsheetId={String(node.config.spreadsheetId)}
              sheetName={String(node.config.sheetName)}
              values={(node.config.columnValues as Record<string, string>) || {}}
              onChange={(columnValues: Record<string, string>) => onChange({ ...node.config, columnValues })}
            />
          )}
        </div>
      );
    case "google_sheets.action.updateRow":
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Google Account</p>
            <ConnectionPicker
              provider="google"
              value={String(node.config.connectionId || "")}
              onChange={(id) => onChange({ ...node.config, connectionId: id })}
            />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Spreadsheet</p>
            <GoogleSpreadsheetPicker
              connectionId={String(node.config.connectionId || "")}
              value={String(node.config.spreadsheetId || "")}
              onChange={(spreadsheetId: string, spreadsheetName: string) =>
                onChange({ ...node.config, spreadsheetId, spreadsheetName })
              }
            />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Sheet</p>
            <GoogleSheetPicker
              connectionId={String(node.config.connectionId || "")}
              spreadsheetId={String(node.config.spreadsheetId || "")}
              value={String(node.config.sheetName || "")}
              onChange={(sheetName: string) => onChange({ ...node.config, sheetName })}
            />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Row Number</p>
            <input
              type="number"
              value={Number(node.config.rowNumber || 2)}
              onChange={(e) => onChange({ ...node.config, rowNumber: parseInt(e.target.value) || 2 })}
              placeholder="2"
              className="w-full rounded border px-2 py-1 text-sm"
            />
            <p className="text-xs text-muted-foreground">Can use {"{{steps.trigger1.rowNumber}}"}</p>
          </div>
          {String(node.config.connectionId) && String(node.config.spreadsheetId) && String(node.config.sheetName) && (
            <GoogleSheetColumnMapper
              connectionId={String(node.config.connectionId)}
              spreadsheetId={String(node.config.spreadsheetId)}
              sheetName={String(node.config.sheetName)}
              values={(node.config.values as Record<string, string>) || {}}
              onChange={(values: Record<string, string>) => onChange({ ...node.config, values })}
            />
          )}
        </div>
      );
    case "google_sheets.action.getRow":
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Google Account</p>
            <ConnectionPicker
              provider="google"
              value={String(node.config.connectionId || "")}
              onChange={(id) => onChange({ ...node.config, connectionId: id })}
            />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Spreadsheet</p>
            <GoogleSpreadsheetPicker
              connectionId={String(node.config.connectionId || "")}
              value={String(node.config.spreadsheetId || "")}
              onChange={(spreadsheetId: string, spreadsheetName: string) =>
                onChange({ ...node.config, spreadsheetId, spreadsheetName })
              }
            />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Sheet</p>
            <GoogleSheetPicker
              connectionId={String(node.config.connectionId || "")}
              spreadsheetId={String(node.config.spreadsheetId || "")}
              value={String(node.config.sheetName || "")}
              onChange={(sheetName: string) => onChange({ ...node.config, sheetName })}
            />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Row Number</p>
            <input
              type="number"
              value={Number(node.config.rowNumber || 2)}
              onChange={(e) => onChange({ ...node.config, rowNumber: parseInt(e.target.value) || 2 })}
              placeholder="2"
              className="w-full rounded border px-2 py-1 text-sm"
            />
            <p className="text-xs text-muted-foreground">Can use {`{{steps.trigger1.rowNumber}}`}</p>
          </div>
        </div>
      );
    case "google_sheets.action.searchRows":
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Google Account</p>
            <ConnectionPicker
              provider="google"
              value={String(node.config.connectionId || "")}
              onChange={(id) => onChange({ ...node.config, connectionId: id })}
            />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Spreadsheet</p>
            <GoogleSpreadsheetPicker
              connectionId={String(node.config.connectionId || "")}
              value={String(node.config.spreadsheetId || "")}
              onChange={(spreadsheetId: string, spreadsheetName: string) =>
                onChange({ ...node.config, spreadsheetId, spreadsheetName })
              }
            />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Sheet</p>
            <GoogleSheetPicker
              connectionId={String(node.config.connectionId || "")}
              spreadsheetId={String(node.config.spreadsheetId || "")}
              value={String(node.config.sheetName || "")}
              onChange={(sheetName: string) => onChange({ ...node.config, sheetName })}
            />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Search Column</p>
            <input
              value={String(node.config.searchColumn || "ALL")}
              onChange={(e) => onChange({ ...node.config, searchColumn: e.target.value })}
              placeholder="ALL or column name"
              className="w-full rounded border px-2 py-1 text-sm"
            />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Search Value</p>
            <input
              value={String(node.config.searchValue || "")}
              onChange={(e) => onChange({ ...node.config, searchValue: e.target.value })}
              placeholder={`{{steps.trigger1.email}}`}
              className="w-full rounded border px-2 py-1 text-sm"
            />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Limit (optional)</p>
            <input
              type="number"
              value={String(node.config.limit || "")}
              onChange={(e) => onChange({ ...node.config, limit: e.target.value ? parseInt(e.target.value) : undefined })}
              placeholder="10"
              className="w-full rounded border px-2 py-1 text-sm"
            />
          </div>
        </div>
      );
    case "google_sheets.trigger.watchNewRows":
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Google Account</p>
            <ConnectionPicker
              provider="google"
              value={String(node.config.connectionId || "")}
              onChange={(id) => onChange({ ...node.config, connectionId: id })}
            />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Spreadsheet</p>
            <GoogleSpreadsheetPicker
              connectionId={String(node.config.connectionId || "")}
              value={String(node.config.spreadsheetId || "")}
              onChange={(spreadsheetId: string, spreadsheetName: string) =>
                onChange({ ...node.config, spreadsheetId, spreadsheetName })
              }
            />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Sheet</p>
            <GoogleSheetPicker
              connectionId={String(node.config.connectionId || "")}
              spreadsheetId={String(node.config.spreadsheetId || "")}
              value={String(node.config.sheetName || "")}
              onChange={(sheetName: string) => onChange({ ...node.config, sheetName })}
            />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Start From Row</p>
            <input
              type="number"
              value={Number(node.config.fromRow || 2)}
              onChange={(e) => onChange({ ...node.config, fromRow: parseInt(e.target.value) || 2 })}
              placeholder="2"
              className="w-full rounded border px-2 py-1 text-sm"
            />
            <p className="text-xs text-muted-foreground">Row to start polling from (usually 2 after headers)</p>
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Start Mode</p>
            <select
              value={String(node.config.startMode || "from_now")}
              onChange={(e) => onChange({ ...node.config, startMode: e.target.value })}
              className="w-full rounded border px-2 py-1 text-sm"
            >
              <option value="from_now">From now (skip existing rows)</option>
              <option value="all_existing_rows">All existing rows</option>
            </select>
          </div>
        </div>
      );
    case "google_drive.action.createFolder":
      return (
        <CreateFolderConfig
          config={node.config}
          onChange={(config) => onChange(config as Record<string, unknown>)}
          connectionId={String(node.config.connectionId || "")}
        />
      );
    case "google_drive.action.setSharingPreference":
      return (
        <SetSharingPreferenceConfig
          config={node.config}
          onChange={(config) => onChange(config as Record<string, unknown>)}
        />
      );
    default:
      return (
        <p className="text-sm text-muted-foreground">
          No configuration for this node type.
        </p>
      );
  }
}

function WorkflowBuilderShell(props: WorkflowBuilderClientProps) {
  const initialState = useMemo(() => hydrateState(props.initialDefinition), [props.initialDefinition]);
  const initialFlowNodes = useMemo(() => toReactFlowNodes(initialState.nodes, initialState.edges), [initialState.nodes, initialState.edges]);
  const initialFlowEdges = useMemo(() => toReactFlowEdges(initialState.edges), [initialState.edges]);
  
  const [nodes, setNodes, onNodesChange] = useNodesState(initialFlowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialFlowEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [status, setStatus] = useState<WorkflowStatus>(props.initialStatus);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);
  const [executeMessage, setExecuteMessage] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [showPalette, setShowPalette] = useState(false);
  const [paletteSourceNode, setPaletteSourceNode] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(true);
  const [workflowName, setWorkflowName] = useState(props.workflowName);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(props.workflowName);
  const [nodeSearch, setNodeSearch] = useState("");

  useEffect(() => {
    if (flowInstance) {
      const timer = setTimeout(() => {
        flowInstance.fitView({ padding: 0.3, duration: 300 });
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [flowInstance]);

  const handleAddNodeFromPlus = useCallback((sourceNodeId?: string) => {
    if (sourceNodeId) {
      setPaletteSourceNode(sourceNodeId);
      setShowPalette(true);
    } else {
      setPaletteSourceNode(null);
      setShowPalette(true);
    }
  }, []);

  const addNode = useCallback((templateKey: string) => {
    const template = NODE_LIBRARY.find((t) => t.key === templateKey);
    if (!template) return;
    
    const newNodeId = `node_${nanoid(6)}`;
    const newFlowNode: FlowNode = {
      id: newNodeId,
      position: { x: 120 + nodes.length * 40, y: 120 + nodes.length * 30 },
      data: {
        label: template.label,
        category: template.category,
        nodeType: template.nodeType,
        config: { ...template.defaultConfig },
        onAddNode: () => handleAddNodeFromPlus(newNodeId),
        canAdd: true,
        appIcon: getAppIcon(template.nodeType),
      },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      type: "custom",
    };
    
    setNodes((nds) => [...nds, newFlowNode]);
    
    if (paletteSourceNode && paletteSourceNode !== newNodeId) {
      const newEdge: FlowEdge = {
        id: `edge_${nanoid(8)}`,
        source: paletteSourceNode,
        target: newNodeId,
        sourceHandle: 'b',
        targetHandle: 't',
        type: 'smoothstep',
        animated: false,
        style: { stroke: "#334155", strokeWidth: 2.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#334155", width: 20, height: 20 },
      };
      setEdges((eds) => addEdge(newEdge, eds));
      setPaletteSourceNode(null);
    }
  }, [nodes.length, paletteSourceNode, handleAddNodeFromPlus, setNodes, setEdges]);

  const handleConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;
    
    const newEdge: FlowEdge = {
      id: `edge_${nanoid(8)}`,
      source: connection.source,
      target: connection.target,
      sourceHandle: 'b',
      targetHandle: 't',
      type: 'smoothstep',
      animated: false,
      style: { stroke: "#334155", strokeWidth: 2.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: "#334155", width: 20, height: 20 },
    };
    
    setEdges((eds) => addEdge(newEdge, eds));
  }, [setEdges]);

  const updateNodeConfig = useCallback((nodeId: string, config: Record<string, unknown>) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, config } }
          : n
      )
    );
  }, [setNodes]);

  const removeNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setSelectedNodeId(null);
  }, [setNodes, setEdges]);

  const updateEdgeCondition = useCallback((edgeId: string, value: string) => {
    setEdges((eds) =>
      eds.map((e) =>
        e.id === edgeId
          ? { ...e, label: value || undefined, data: { ...(e.data || {}), condition: value || undefined } }
          : e
      )
    );
  }, [setEdges]);

  const removeEdge = useCallback((edgeId: string) => {
    setEdges((eds) => eds.filter((e) => e.id !== edgeId));
  }, [setEdges]);

  const getCurrentState = useCallback((): WorkflowState => {
    return {
      nodes: nodes.map((n) => ({
        id: n.id,
        nodeType: n.data.nodeType,
        category: n.data.category,
        config: n.data.config || {},
        position: n.position,
      })),
      edges: edges.map((e) => {
        const conditionValue = (e.data as Record<string, unknown> | undefined)?.condition;
        const condition = typeof conditionValue === "string" ? conditionValue : (e.label as string | undefined);
        return {
          id: e.id,
          from: e.source,
          to: e.target,
          condition: condition || undefined,
        };
      }),
    };
  }, [nodes, edges]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const currentState = getCurrentState();
      const payload = serializeDefinition(currentState);
      const res = await fetch(`/api/workflows/${props.workflowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ definition: payload }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSaveMessage(json?.details || json?.error || "Failed to save workflow");
      } else {
        const nextStatus = (json?.workflow?.status as WorkflowStatus) || status;
        setStatus(nextStatus);
        setSaveMessage("Saved successfully");
      }
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "Failed to save workflow");
    } finally {
      setSaving(false);
    }
  }, [props.workflowId, getCurrentState, status]);

  const handleSaveWorkflowName = useCallback(async (newName: string) => {
    if (!newName.trim() || newName === workflowName) {
      setIsEditingName(false);
      setEditedName(workflowName);
      return;
    }

    try {
      const res = await fetch(`/api/workflows/${props.workflowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });

      if (res.ok) {
        setWorkflowName(newName.trim());
        setSaveMessage("Workflow name updated");
      } else {
        setSaveMessage("Failed to update workflow name");
        setEditedName(workflowName);
      }
    } catch (error) {
      setSaveMessage("Failed to update workflow name");
      setEditedName(workflowName);
    } finally {
      setIsEditingName(false);
    }
  }, [props.workflowId, workflowName]);

  const handleToggleActivation = useCallback(async () => {
    setActivating(true);
    setSaveMessage(null);
    try {
      const method = status === "ACTIVE" ? "DELETE" : "POST";
      const res = await fetch(`/api/workflows/${props.workflowId}/activate`, { method });
      const json = await res.json();
      if (!res.ok) {
        setSaveMessage(json?.message || json?.error || "Failed to update status");
        return;
      }
      const nextStatus = (json?.status as WorkflowStatus) || (status === "ACTIVE" ? "PAUSED" : "ACTIVE");
      setStatus(nextStatus);
      setSaveMessage(nextStatus === "ACTIVE" ? "Workflow activated" : "Workflow deactivated");
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "Failed to update status");
    } finally {
      setActivating(false);
    }
  }, [props.workflowId, status]);

  const handleExecute = useCallback(async (testMode: boolean = false) => {
    setExecuting(true);
    setExecuteMessage(null);
    try {
      const res = await fetch(`/api/workflows/${props.workflowId}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ executionMode: testMode ? "test" : "live" }),
      });
      const json = await res.json();
      if (!res.ok) {
        setExecuteMessage(json?.error || "Failed to execute workflow");
      } else {
        setExecuteMessage(
          `${testMode ? "Test" : "Live"} execution started: ${json.executionId}`
        );
      }
    } catch (error) {
      setExecuteMessage(error instanceof Error ? error.message : "Failed to execute workflow");
    } finally {
      setExecuting(false);
    }
  }, [props.workflowId]);

  const selectedNode = useMemo(() => {
    const flowNode = nodes.find((n) => n.id === selectedNodeId);
    if (!flowNode) return null;
    return {
      id: flowNode.id,
      nodeType: flowNode.data.nodeType,
      category: flowNode.data.category,
      config: flowNode.data.config || {},
      position: flowNode.position,
    } as BuilderNode;
  }, [nodes, selectedNodeId]);

  return (
    <ReactFlowProvider>
      <div className="w-full h-screen flex flex-col py-4 px-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">Workflow Builder</p>
            {isEditingName ? (
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onBlur={() => handleSaveWorkflowName(editedName)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSaveWorkflowName(editedName);
                  } else if (e.key === "Escape") {
                    setIsEditingName(false);
                    setEditedName(workflowName);
                  }
                }}
                autoFocus
                className="text-2xl font-mono font-bold bg-transparent border-b-2 border-primary outline-none max-w-md"
              />
            ) : (
              <h1
                className="text-2xl font-mono font-bold cursor-pointer hover:text-primary transition-colors"
                onClick={() => setIsEditingName(true)}
                title="Click to edit"
              >
                {workflowName}
              </h1>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-mono px-2 py-1 rounded border ${
                status === "ACTIVE"
                  ? "border-green-200 bg-green-50 text-green-800"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              }`}
            >
              Status: {status}
            </span>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setDarkMode(!darkMode)}
              className="mr-2"
            >
              {darkMode ? "🌙 Dark" : "☀️ Light"}
            </Button>
            <Button variant={status === "ACTIVE" ? "outline" : "secondary"} onClick={handleToggleActivation} disabled={activating}>
              {activating
                ? "Updating..."
                : status === "ACTIVE"
                ? "Deactivate"
                : "Activate"}
            </Button>
            <Button variant="outline" onClick={() => handleExecute(true)} disabled={executing}>
              {executing ? "Testing..." : "🧪 Test Trigger"}
            </Button>
            <Button variant="secondary" onClick={() => handleExecute(false)} disabled={executing}>
              {executing ? "Executing..." : "Execute Workflow"}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Workflow"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-3 flex-1">
          {/* Left Palette - Drag and Drop Nodes */}
          <div className="col-span-2 bg-slate-900 rounded-lg border border-slate-800 p-3 max-h-[70vh] overflow-hidden flex flex-col">
            <div className="text-xs font-semibold text-slate-300 uppercase mb-2">Add Nodes</div>
            <input
              value={nodeSearch}
              onChange={(e) => setNodeSearch(e.target.value)}
              placeholder="Search nodes..."
              className="mb-3 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            <div className="space-y-2 overflow-y-auto max-h-[calc(70vh-76px)] pr-1">
              {NODE_LIBRARY.filter((tmpl) => {
                if (!nodeSearch.trim()) return true;
                const q = nodeSearch.toLowerCase();
                return (
                  tmpl.label.toLowerCase().includes(q) ||
                  tmpl.nodeType.toLowerCase().includes(q) ||
                  tmpl.category.toLowerCase().includes(q)
                );
              }).map((tmpl) => (
                <div
                  key={tmpl.key}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("node-template", JSON.stringify(tmpl));
                  }}
                  className="p-3 bg-slate-800 border border-slate-700 rounded cursor-move hover:bg-slate-700 hover:border-slate-600 transition-colors text-xs font-medium text-slate-200"
                >
                  <div className="font-semibold">{tmpl.label}</div>
                  <div className="text-slate-400 text-[11px]">{tmpl.category}</div>
                </div>
              ))}
              {NODE_LIBRARY.filter((tmpl) => {
                if (!nodeSearch.trim()) return false;
                const q = nodeSearch.toLowerCase();
                return !(
                  tmpl.label.toLowerCase().includes(q) ||
                  tmpl.nodeType.toLowerCase().includes(q) ||
                  tmpl.category.toLowerCase().includes(q)
                );
              }).length === NODE_LIBRARY.length && (
                <div className="text-xs text-slate-500">No nodes found.</div>
              )}
            </div>
          </div>

          {/* Canvas and Config */}
          <div className="col-span-7 space-y-2 flex flex-col">
            <div
              className="border rounded-lg relative flex-1 overflow-visible"
              style={{ background: darkMode ? "#1a1a1a" : "#fafafa" }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => {
                e.preventDefault();
                const data = e.dataTransfer.getData("node-template");
                if (data && flowInstance) {
                  const template = JSON.parse(data);
                  const pos = flowInstance.screenToFlowPosition({
                    x: e.clientX,
                    y: e.clientY,
                  });
                  
                  const newNodeId = `node_${nanoid(6)}`;
                  const newFlowNode: FlowNode = {
                    id: newNodeId,
                    position: pos,
                    data: {
                      label: template.label,
                      nodeType: template.nodeType,
                      category: template.category,
                      config: { ...template.defaultConfig },
                      appIcon: getAppIcon(template.nodeType),
                      onAddNode: () => handleAddNodeFromPlus(newNodeId),
                      canAdd: true,
                      onConfigChange: (cfg: Record<string, unknown>) => updateNodeConfig(newNodeId, cfg),
                      onDelete: () => removeNode(newNodeId),
                    },
                    sourcePosition: Position.Bottom,
                    targetPosition: Position.Top,
                    type: "custom",
                  };
                  setNodes((nds) => [...nds, newFlowNode]);
                }
              }}
            >
              <div style={{ position: "absolute", top: "10px", left: "10px", zIndex: 50 }}>
                <Button
                  size="sm"
                  onClick={() => {
                    setPaletteSourceNode(null);
                    setShowPalette(true);
                  }}
                >
                  <Plus size={14} className="mr-1" /> Add Node
                </Button>
              </div>

              {showPalette && (
                <div className="absolute left-3 top-12 z-50 w-80 max-h-[70vh] overflow-hidden rounded-lg border bg-slate-900 border-slate-700 shadow-xl flex flex-col">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700 bg-slate-800">
                    <span className="text-sm font-semibold text-slate-200">Add Node</span>
                    <Button variant="ghost" size="sm" onClick={() => {
                      setShowPalette(false);
                      setPaletteSourceNode(null);
                    }} className="text-slate-400 hover:text-slate-200">
                      Close
                    </Button>
                  </div>
                  <div className="p-3 grid grid-cols-1 gap-2 overflow-y-auto max-h-[calc(70vh-44px)]">
                    {NODE_LIBRARY.map((tmpl) => (
                      <button
                        key={tmpl.key}
                        className="flex w-full items-center justify-between rounded border border-slate-700 px-3 py-2 text-left text-sm bg-slate-800 hover:bg-slate-700 hover:border-slate-600 text-slate-200"
                        onClick={() => {
                          addNode(tmpl.key);
                          setShowPalette(false);
                        }}
                      >
                        <span className="font-medium">{tmpl.label}</span>
                        <span className="text-[11px] uppercase tracking-wide text-slate-400">
                          {tmpl.category}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {nodes.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 60 }}>
                  <div className={`flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-8 text-center ${
                    darkMode 
                      ? "border-slate-600 bg-slate-800 text-slate-200" 
                      : "border-slate-300 bg-slate-50"
                  }`}>
                    <p className="font-medium">Drag nodes from the palette</p>
                    <p className={`text-sm ${darkMode ? "text-slate-400" : "text-slate-600"}`}>or use the Add Node button</p>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        addNode("manual");
                        setShowPalette(false);
                      }}
                      className="mt-2"
                    >
                      <Plus size={14} className="mr-1" /> Add node
                    </Button>
                  </div>
                </div>
              )}

              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={handleConnect}
                onInit={setFlowInstance}
                onNodeClick={(_, node) => setSelectedNodeId(node.id)}
                onPaneClick={() => setSelectedNodeId(null)}
                fitView
                fitViewOptions={{ padding: 0.3 }}
                defaultEdgeOptions={{
                  animated: true,
                  style: { stroke: "#3b82f6", strokeWidth: 4 },
                  markerEnd: { type: MarkerType.ArrowClosed, color: "#3b82f6" },
                }}
                minZoom={0.1}
                maxZoom={4}
                className="bg-muted"
                proOptions={{ hideAttribution: true }}
              >
                <Background color={darkMode ? "#2a2a2a" : "#e0e0e0"} />
                <Controls />
              </ReactFlow>
            </div>
          </div>

          {/* Right Config Panels */}
          <div className="col-span-3">
            <div className="space-y-4 max-h-full overflow-y-auto">
              <Card>
                <CardHeader>
                  <CardTitle className="font-mono text-sm">Node Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!selectedNode ? (
                    <p className="text-sm text-muted-foreground">Select a node to edit its configuration.</p>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-mono text-sm">{selectedNode.id}</div>
                          <div className="text-xs text-muted-foreground">{selectedNode.nodeType}</div>
                        </div>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => removeNode(selectedNode.id)}
                        >
                          Delete
                        </Button>
                      </div>
                      <div className="border-t" />
                      <NodeConfigForm
                        node={selectedNode}
                        onChange={(config) => updateNodeConfig(selectedNode.id, config)}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="font-mono text-sm">Edges</CardTitle>
                </CardHeader>
              <CardContent className="space-y-3">
                {edges.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No edges. Connect nodes on the canvas.</p>
                ) : (
                  <div className="space-y-3">
                    {edges.map((edge) => {
                      const conditionValue = (edge.data as Record<string, unknown> | undefined)?.condition;
                      const condition = typeof conditionValue === "string" ? conditionValue : (edge.label as string | undefined);
                      return (
                      <div key={edge.id} className="border rounded p-2">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-mono text-xs text-muted-foreground">
                            {edge.source} → {edge.target}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs"
                            onClick={() => removeEdge(edge.id)}
                          >
                            Delete
                          </Button>
                        </div>
                        <p className="font-mono text-[11px] text-muted-foreground">Condition (optional)</p>
                        <input
                          value={condition || ""}
                          onChange={(e) => updateEdgeCondition(edge.id, e.target.value)}
                          placeholder="true / false / any string"
                          className="w-full rounded border px-2 py-1 text-sm"
                        />
                      </div>
                    );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
            </div>

            {saveMessage && (
              <Card className="border border-muted-foreground/40">
                <CardContent className="py-3 text-sm">
                  {saveMessage}
                </CardContent>
              </Card>
            )}

            {executeMessage && (
              <Card className="border border-muted-foreground/40">
                <CardContent className="py-3 text-sm">
                  {executeMessage}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </ReactFlowProvider>
  );
}

export default function WorkflowBuilderClient(props: WorkflowBuilderClientProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="p-6 text-sm text-muted-foreground">Loading builder...</div>;
  }

  return <WorkflowBuilderShell {...props} />;
}
