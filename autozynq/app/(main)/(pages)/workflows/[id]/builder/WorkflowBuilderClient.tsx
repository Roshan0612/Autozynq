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
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  ReactFlowProvider,
  ReactFlowInstance,
  MarkerType,
  BaseEdge,
  getStraightPath,
  EdgeProps,
} from "reactflow";
import "reactflow/dist/style.css";
import { nanoid } from "nanoid";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkflowDefinition } from "@/lib/workflow/schema";

// Custom node component - professional dark theme
function CustomNode({ data }: { data: any }) {
  const categoryColors: Record<string, { bg: string; border: string; text: string }> = {
    trigger: { bg: "#1e3a8a", border: "#3b82f6", text: "#93c5fd" },
    action: { bg: "#1f2937", border: "#6b7280", text: "#d1d5db" },
    logic: { bg: "#4c1d95", border: "#a78bfa", text: "#e9d5ff" },
  };

  const colors = categoryColors[data.category] || categoryColors.action;

  return (
    <div
      style={{
        position: "relative",
        background: colors.bg,
        border: `2px solid ${colors.border}`,
        padding: "12px 16px",
        color: colors.text,
        fontSize: "13px",
        fontWeight: 500,
        minWidth: "140px",
        borderRadius: "6px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
        pointerEvents: "auto",
        cursor: "grab",
        textAlign: "center",
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        isConnectable
        style={{ background: colors.border, width: 10, height: 10, border: "2px solid #000" }}
      />
      <div style={{ fontWeight: 600, marginBottom: "4px" }}>{data.label || "Node"}</div>
      <div style={{ fontSize: "11px", opacity: 0.8 }}>{data.nodeType}</div>
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable
        style={{ background: colors.border, width: 10, height: 10, border: "2px solid #000" }}
      />
    </div>
  );
}

// Professional edge component
function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  style,
  data,
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
}

type NodeCategory = "trigger" | "action" | "logic";

type BuilderNode = {
  id: string;
  nodeType: string;
  category: NodeCategory;
  config: Record<string, any>;
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
  defaultConfig: Record<string, any>;
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
      prompt: "",
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
    defaultConfig: { connectionId: "stub-conn", formId: "form_123", since: undefined },
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
  {
    key: "gmail-send-email",
    label: "Gmail – Send Email",
    category: "action",
    nodeType: "gmail.action.sendEmail",
    defaultConfig: {
      connectionId: "stub-conn",
      to: "{{answers.Email}}",
      subject: "{{subject}}",
      body: "{{body}}",
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
    const nodeType = (node as any).type || (node as any).nodeType || "";
    return {
      id: node.id,
      nodeType,
      category: inferCategory(nodeType),
      config: (node.config as Record<string, any>) ?? {},
      position:
        positions[node.id] || {
          x: 100 + (idx % 4) * 200,
          y: 80 + Math.floor(idx / 4) * 140,
        },
    };
  });

  const edges: BuilderEdge[] = (definition.edges || []).map((edge, idx) => ({
    id: edge.from + "-" + edge.to + "-" + idx,
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
      onAddNode: () => onAddNode?.(node.id),
      canAdd: !edges.some((e) => e.from === node.id),
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
    type: 'custom',
    label: edge.condition || undefined,
    data: { condition: edge.condition },
    animated: true,
    style: { stroke: "#3b82f6", strokeWidth: 4 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#3b82f6" },
  }));
}

function serializeDefinition(state: WorkflowState): WorkflowDefinition {
  return {
    nodes: state.nodes.map((node) => ({
      id: node.id,
      type: node.nodeType,
      config: node.config ?? {},
    })),
    edges: state.edges.map((edge) => ({
      from: edge.from,
      to: edge.to,
      ...(edge.condition ? { condition: edge.condition } : {}),
    })),
    ui: {
      positions: state.nodes.reduce<Record<string, { x: number; y: number }>>((acc, node) => {
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
  onChange: (config: Record<string, any>) => void;
}) {
  const template = templateByType[node.nodeType];

  switch (node.nodeType) {
    case "trigger.webhook.basic":
      return (
        <div className="space-y-3">
          <p className="font-mono text-xs text-muted-foreground">Description</p>
          <input
            value={node.config.description || ""}
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
            <p className="font-mono text-xs text-muted-foreground">Connection ID</p>
            <input
              value={node.config.connectionId || ""}
              onChange={(e) => onChange({ ...node.config, connectionId: e.target.value })}
              placeholder="stub-conn"
              className="w-full rounded border px-2 py-1 text-sm"
            />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Form ID</p>
            <input
              value={node.config.formId || ""}
              onChange={(e) => onChange({ ...node.config, formId: e.target.value })}
              placeholder="form_123"
              className="w-full rounded border px-2 py-1 text-sm"
            />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Since (ISO, optional)</p>
            <input
              value={node.config.since || ""}
              onChange={(e) => onChange({ ...node.config, since: e.target.value || undefined })}
              placeholder="2024-01-01T00:00:00.000Z"
              className="w-full rounded border px-2 py-1 text-sm"
            />
          </div>
        </div>
      );
    case "ai.action.generateEmail":
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Instructions (optional)</p>
            <textarea
              value={node.config.instructions || ""}
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
              value={node.config.connectionId || ""}
              onChange={(e) => onChange({ ...node.config, connectionId: e.target.value })}
              placeholder="stub-conn"
              className="w-full rounded border px-2 py-1 text-sm"
            />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Form ID</p>
            <input
              value={node.config.formId || ""}
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
              value={node.config.connectionId || ""}
              onChange={(e) => onChange({ ...node.config, connectionId: e.target.value })}
              placeholder="stub-conn"
              className="w-full rounded border px-2 py-1 text-sm"
            />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Form ID</p>
            <input
              value={node.config.formId || ""}
              onChange={(e) => onChange({ ...node.config, formId: e.target.value })}
              placeholder="form_123"
              className="w-full rounded border px-2 py-1 text-sm"
            />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Response ID</p>
            <input
              value={node.config.responseId || ""}
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
              value={node.config.connectionId || ""}
              onChange={(e) => onChange({ ...node.config, connectionId: e.target.value })}
              placeholder="stub-conn"
              className="w-full rounded border px-2 py-1 text-sm"
            />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Form ID</p>
            <input
              value={node.config.formId || ""}
              onChange={(e) => onChange({ ...node.config, formId: e.target.value })}
              placeholder="form_123"
              className="w-full rounded border px-2 py-1 text-sm"
            />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Limit (optional)</p>
            <input
              type="number"
              value={node.config.limit ?? ""}
              onChange={(e) => onChange({ ...node.config, limit: e.target.value ? parseInt(e.target.value) : undefined })}
              placeholder="2"
              className="w-full rounded border px-2 py-1 text-sm"
            />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Since (ISO, optional)</p>
            <input
              value={node.config.since || ""}
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
              value={node.config.url || ""}
              onChange={(e) => onChange({ ...node.config, url: e.target.value })}
              placeholder="https://api.example.com"
              className="w-full rounded border px-2 py-1 text-sm"
            />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Method</p>
            <select
              className="w-full rounded border px-2 py-1 text-sm"
              value={node.config.method || "GET"}
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
              value={node.config.message || ""}
              onChange={(e) => onChange({ ...node.config, message: e.target.value })}
              placeholder="Debug message"
              className="w-full rounded border px-2 py-1 text-sm"
            />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Level</p>
            <select
              className="w-full rounded border px-2 py-1 text-sm"
              value={node.config.level || "info"}
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
            <p className="font-mono text-xs text-muted-foreground">Connection ID</p>
            <input
              value={node.config.connectionId || ""}
              onChange={(e) => onChange({ ...node.config, connectionId: e.target.value })}
              placeholder="stub-conn"
              className="w-full rounded border px-2 py-1 text-sm"
            />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">To</p>
            <input
              value={node.config.to || ""}
              onChange={(e) => onChange({ ...node.config, to: e.target.value })}
              placeholder="{{answers.Email}} or someone@example.com"
              className="w-full rounded border px-2 py-1 text-sm"
            />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Subject</p>
            <input
              value={node.config.subject || ""}
              onChange={(e) => onChange({ ...node.config, subject: e.target.value })}
              placeholder="{{subject}}"
              className="w-full rounded border px-2 py-1 text-sm"
            />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Body</p>
            <textarea
              value={node.config.body || ""}
              onChange={(e) => onChange({ ...node.config, body: e.target.value })}
              placeholder="{{body}}"
              className="w-full rounded border px-2 py-2 text-sm font-mono"
              rows={6}
            />
            <p className="text-xs text-muted-foreground">Supports {"{{path}}"} from previous output (e.g., {"{{answers.Email}}"}, {"{{subject}}"}, {"{{body}}"}).</p>
          </div>
        </div>
      );
    case "ai.action.generateText":
      const provider = node.config.provider || "groq";
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
              value={node.config.model || defaultModel}
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
              value={node.config.systemPrompt || ""}
              onChange={(e) => onChange({ ...node.config, systemPrompt: e.target.value })}
              placeholder="You are a helpful assistant..."
              className="w-full rounded border px-2 py-2 text-sm font-mono"
              rows={3}
            />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Prompt *</p>
            <textarea
              value={node.config.prompt || ""}
              onChange={(e) => onChange({ ...node.config, prompt: e.target.value })}
              placeholder="Generate a creative blog post title about..."
              className="w-full rounded border px-2 py-2 text-sm font-mono"
              rows={5}
            />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Temperature ({node.config.temperature ?? 0.7})</p>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={node.config.temperature ?? 0.7}
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
              value={node.config.maxTokens ?? 500}
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
              value={node.config.operator || "equals"}
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
    default:
      return (
        <p className="text-sm text-muted-foreground">
          No configuration for this node type.
        </p>
      );
  }
}

function WorkflowBuilderShell(props: WorkflowBuilderClientProps) {
  const [state, setState] = useState<WorkflowState>(() => hydrateState(props.initialDefinition));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);
  const [executeMessage, setExecuteMessage] = useState<string | null>(null);
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [showPalette, setShowPalette] = useState(false);
  const [paletteSourceNode, setPaletteSourceNode] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    if (flowInstance) {
      const timer = setTimeout(() => {
        flowInstance.fitView({ padding: 0.3, duration: 300 });
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [flowInstance]);

  const addNode = useCallback((templateKey: string) => {
    const template = NODE_LIBRARY.find((t) => t.key === templateKey);
    if (!template) return;
    
    setState((prev) => {
      const newNode: BuilderNode = {
        id: `node_${nanoid(6)}`,
        nodeType: template.nodeType,
        category: template.category,
        config: { ...template.defaultConfig },
        position: { x: 120 + prev.nodes.length * 40, y: 120 + prev.nodes.length * 30 },
      };
      
      const newState = { ...prev, nodes: [...prev.nodes, newNode] };
      
      if (paletteSourceNode && paletteSourceNode !== newNode.id) {
        const newEdge: BuilderEdge = {
          id: `e-${nanoid(6)}`,
          from: paletteSourceNode,
          to: newNode.id,
        };
        newState.edges = [...newState.edges, newEdge];
        setPaletteSourceNode(null);
      }
      
      return newState;
    });
  }, [paletteSourceNode]);

  const handleAddNodeFromPlus = useCallback((sourceNodeId?: string) => {
    if (sourceNodeId) {
      setPaletteSourceNode(sourceNodeId);
      setShowPalette(true);
    } else {
      setPaletteSourceNode(null);
      setShowPalette(true);
    }
  }, []);

  const flowNodes = useMemo(() => 
    toReactFlowNodes(state.nodes, state.edges, handleAddNodeFromPlus),
    [state.nodes, state.edges, handleAddNodeFromPlus]
  );
  
  const flowEdges = useMemo(() => toReactFlowEdges(state.edges), [state.edges]);

  const onNodesChange = useCallback((changes: any) => {
    setState((prev) => {
      const updatedFlow = applyNodeChanges(changes, toReactFlowNodes(prev.nodes, prev.edges));
      const updatedNodes: BuilderNode[] = prev.nodes.map((node) => {
        const match = updatedFlow.find((n) => n.id === node.id);
        return match ? { ...node, position: match.position } : node;
      });
      return { ...prev, nodes: updatedNodes };
    });
  }, []);

  const onEdgesChange = useCallback((changes: any) => {
    setState((prev) => {
      const updatedFlow = applyEdgeChanges(changes, toReactFlowEdges(prev.edges));
      const updatedEdges: BuilderEdge[] = updatedFlow.map((edge) => ({
        id: edge.id,
        from: edge.source,
        to: edge.target,
        condition: (edge.data as any)?.condition || edge.label || undefined,
      }));
      return { ...prev, edges: updatedEdges };
    });
  }, []);

  const onConnect = useCallback((connection: Connection) => {
    setState((prev) => {
      if (!connection.source || !connection.target) return prev;
      const exists = prev.edges.some(
        (e) => e.from === connection.source && e.to === connection.target
      );
      if (exists) return prev;
      const newEdge: BuilderEdge = {
        id: `e-${nanoid(6)}`,
        from: connection.source,
        to: connection.target,
      };
      return { ...prev, edges: [...prev.edges, newEdge] };
    });
  }, []);

  const updateNodeConfig = useCallback((nodeId: string, config: Record<string, any>) => {
    setState((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => (n.id === nodeId ? { ...n, config } : n)),
    }));
  }, []);

  const removeNode = useCallback((nodeId: string) => {
    setState((prev) => ({
      nodes: prev.nodes.filter((n) => n.id !== nodeId),
      edges: prev.edges.filter((e) => e.from !== nodeId && e.to !== nodeId),
    }));
    setSelectedNodeId(null);
  }, []);

  const updateEdgeCondition = useCallback((edgeId: string, value: string) => {
    setState((prev) => ({
      ...prev,
      edges: prev.edges.map((e) => (e.id === edgeId ? { ...e, condition: value || undefined } : e)),
    }));
  }, []);

  const removeEdge = useCallback((edgeId: string) => {
    setState((prev) => ({
      ...prev,
      edges: prev.edges.filter((e) => e.id !== edgeId),
    }));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const payload = serializeDefinition(state);
      const res = await fetch(`/api/workflows/${props.workflowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ definition: payload }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSaveMessage(json?.error || "Failed to save workflow");
      } else {
        setSaveMessage("Saved successfully");
      }
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "Failed to save workflow");
    } finally {
      setSaving(false);
    }
  }, [props.workflowId, state]);

  const handleExecute = useCallback(async () => {
    setExecuting(true);
    setExecuteMessage(null);
    try {
      const res = await fetch(`/api/workflows/${props.workflowId}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) {
        setExecuteMessage(json?.error || "Failed to execute workflow");
      } else {
        setExecuteMessage(`Execution started: ${json.executionId}`);
      }
    } catch (error) {
      setExecuteMessage(error instanceof Error ? error.message : "Failed to execute workflow");
    } finally {
      setExecuting(false);
    }
  }, [props.workflowId]);

  const selectedNode = state.nodes.find((n) => n.id === selectedNodeId) || null;

  return (
    <ReactFlowProvider>
      <div className="w-full h-screen flex flex-col py-4 px-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-muted-foreground">Workflow Builder</p>
            <h1 className="text-2xl font-mono font-bold">{props.workflowName}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setDarkMode(!darkMode)}
              className="mr-2"
            >
              {darkMode ? "🌙 Dark" : "☀️ Light"}
            </Button>
            <Button variant="secondary" onClick={handleExecute} disabled={executing}>
              {executing ? "Executing..." : "Execute Workflow"}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Workflow"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-3 flex-1">
          {/* Left Palette - Drag and Drop Nodes */}
          <div className="col-span-2 bg-slate-900 rounded-lg border border-slate-800 p-3 h-fit max-h-full overflow-y-auto">
            <div className="text-xs font-semibold text-slate-300 uppercase mb-3">Add Nodes</div>
            <div className="space-y-2">
              {NODE_LIBRARY.map((tmpl) => (
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
            </div>
          </div>

          {/* Canvas and Config */}
          <div className="col-span-7 space-y-2 flex flex-col">
            <div
              className="border rounded-lg relative flex-1"
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
                  
                  setState((prev) => {
                    const newNode: BuilderNode = {
                      id: `node_${nanoid(6)}`,
                      nodeType: template.nodeType,
                      category: template.category,
                      config: { ...template.defaultConfig },
                      position: pos,
                    };
                    return { ...prev, nodes: [...prev.nodes, newNode] };
                  });
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
                <div className="absolute left-3 top-12 z-50 w-80 max-h-[480px] overflow-y-auto rounded-lg border bg-slate-900 border-slate-700 shadow-xl">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700 bg-slate-800">
                    <span className="text-sm font-semibold text-slate-200">Add Node</span>
                    <Button variant="ghost" size="sm" onClick={() => {
                      setShowPalette(false);
                      setPaletteSourceNode(null);
                    }} className="text-slate-400 hover:text-slate-200">
                      Close
                    </Button>
                  </div>
                  <div className="p-3 grid grid-cols-1 gap-2">
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

              {state.nodes.length === 0 && (
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
                nodes={flowNodes}
                edges={flowEdges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
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
                {state.edges.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No edges. Connect nodes on the canvas.</p>
                ) : (
                  <div className="space-y-3">
                    {state.edges.map((edge) => (
                      <div key={edge.id} className="border rounded p-2">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-mono text-xs text-muted-foreground">
                            {edge.from} → {edge.to}
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
                          value={edge.condition || ""}
                          onChange={(e) => updateEdgeCondition(edge.id, e.target.value)}
                          placeholder="true / false / any string"
                          className="w-full rounded border px-2 py-1 text-sm"
                        />
                      </div>
                    ))}
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
