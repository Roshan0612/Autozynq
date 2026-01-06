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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkflowDefinition } from "@/lib/workflow/schema";

// Custom node component with a single container and positioned handles
function CustomNode({ data }: { data: any }) {
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
      <Handle
        type="target"
        position={Position.Top}
        isConnectable
        id="t"
        style={{ background: "#3b82f6", width: 12, height: 12, border: "2px solid #1e40af" }}
      />
      {data.label || "Node"}
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable
        id="b"
        style={{ background: "#3b82f6", width: 12, height: 12, border: "2px solid #1e40af" }}
      />
    </div>
  );
}

// Custom edge component that explicitly renders paths
function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
}: EdgeProps) {
  console.log('🔴 CustomEdge rendering for:', id);
  console.log('🔴 Coords:', { sourceX, sourceY, targetX, targetY });
  
  const [edgePath] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });
  
  console.log('🔴 Edge path computed:', edgePath);
  console.log('🔴 markerEnd:', markerEnd);

  return (
    <BaseEdge
      path={edgePath}
      markerEnd={markerEnd}
      style={{
        ...style,
        stroke: "#3b82f6",
        strokeWidth: 4,
        opacity: 1,
        visibility: "visible",
      }}
    />
  );
}

// Stable nodeTypes object - defined outside component to prevent recreation
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
  nodeType: string; // Registry node type (e.g., action.http.request)
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
    key: "if",
    label: "If / Condition",
    category: "logic",
    nodeType: "logic.condition",
    defaultConfig: { operator: "equals", value: "" },
  },
];

const templateByType = NODE_LIBRARY.reduce<Record<string, NodeTemplate>>((acc, tmpl) => {
  acc[tmpl.nodeType] = tmpl;
  return acc;
}, {});

function inferCategory(nodeType: string): NodeCategory {
  return templateByType[nodeType]?.category || (nodeType.includes("logic") ? "logic" : "action");
}

function hydrateState(definition: WorkflowDefinition): WorkflowState {
  // Remove old default seed (manual trigger + log) so builder opens empty unless user added nodes
  const looksLikeDefaultSeed =
    Array.isArray(definition.nodes) &&
    definition.nodes.length === 2 &&
    definition.edges?.length === 1 &&
    definition.nodes.some((n) => n.id === "trigger1" && n.type === "trigger.manual") &&
    definition.nodes.some((n) => n.id === "log1" && n.type === "action.log.debug") &&
    definition.edges[0]?.from === "trigger1" &&
    definition.edges[0]?.to === "log1";

  const cleanedDefinition: WorkflowDefinition = looksLikeDefaultSeed
    ? { nodes: [], edges: [], ui: { positions: {} } }
    : definition;

  const positions = cleanedDefinition.ui?.positions || {};
  const nodes: BuilderNode[] = (cleanedDefinition.nodes || []).map((node, idx) => ({
    id: node.id,
    nodeType: node.type,
    category: inferCategory(node.type),
    config: (node.config as Record<string, any>) ?? {},
    position:
      positions[node.id] || {
        x: 100 + (idx % 4) * 200,
        y: 80 + Math.floor(idx / 4) * 140,
      },
  }));

  const edges: BuilderEdge[] = (cleanedDefinition.edges || []).map((edge, idx) => ({
    id: edge.from + "-" + edge.to + "-" + idx,
    from: edge.from,
    to: edge.to,
    condition: edge.condition || undefined,
  }));

  return { nodes, edges };
}

function toReactFlowNodes(nodes: BuilderNode[]): FlowNode[] {
  return nodes.map((node) => ({
    id: node.id,
    position: node.position,
    data: {
      label: templateByType[node.nodeType]?.label || node.nodeType,
    },
    sourcePosition: Position.Bottom,
    targetPosition: Position.Top,
    type: "custom",
    style: {
      background: "#ffffff",
      color: "#111827",
      border: "2px solid #3b82f6",
      padding: "12px",
      fontSize: "14px",
      fontWeight: 600,
      minWidth: "140px",
      minHeight: "70px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
      borderRadius: "6px",
    },
  }));
}

function toReactFlowEdges(edges: BuilderEdge[]): FlowEdge[] {
  const result = edges.map((edge) => ({
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
  console.log('🔵 toReactFlowEdges() - Converted edges:', result);
  console.log('🔵 Edge type check:', result.map(e => ({ id: e.id, type: e.type })));
  console.log('🔵 Edge count:', result.length);
  return result;
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

  useEffect(() => {
    if (flowInstance) {
      const timer = setTimeout(() => {
        flowInstance.fitView({ padding: 0.3, duration: 300 });
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [flowInstance]);

  // Force re-render after edges change to ensure paths are calculated
  useEffect(() => {
    if (flowInstance && state.edges.length > 0) {
      const timer = setTimeout(() => {
        console.log('Forcing edge update');
        flowInstance.fitView({ padding: 0.3, duration: 0 });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [state.edges, flowInstance]);

  // Explicitly tell React Flow to recompute handle bounds when nodes or edges change
  useEffect(() => {
    if (!flowInstance) return;
    const ids = new Set<string>();
    state.nodes.forEach((n) => ids.add(n.id));
    state.edges.forEach((e) => {
      ids.add(e.from);
      ids.add(e.to);
    });
    ids.forEach((id) => {
      try {
        flowInstance.updateNodeInternals(id);
      } catch (e) {
        // no-op
      }
    });
  }, [flowInstance, state.nodes, state.edges]);

  const flowNodes = useMemo(() => {
    const nodes = toReactFlowNodes(state.nodes);
    console.log('Flow nodes:', nodes);
    return nodes;
  }, [state.nodes]);
  const flowEdges = useMemo(() => {
    const edges = toReactFlowEdges(state.edges);
    console.log('Flow edges:', edges);
    console.log('🔴 Available edgeTypes:', Object.keys(edgeTypes));
    console.log('🔴 flowEdges with types:', edges.map(e => ({ id: e.id, type: e.type })));
    return edges;
  }, [state.edges]);

  const onNodesChange = useCallback(
    (changes) => {
      setState((prev) => {
        const updatedFlow = applyNodeChanges(changes, toReactFlowNodes(prev.nodes));
        const updatedNodes: BuilderNode[] = prev.nodes.map((node) => {
          const match = updatedFlow.find((n) => n.id === node.id);
          return match ? { ...node, position: match.position } : node;
        });
        return { ...prev, nodes: updatedNodes };
      });
    },
    []
  );

  const onEdgesChange = useCallback(
    (changes) => {
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
    },
    []
  );

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

  const addNode = useCallback((templateKey: string) => {
    const template = NODE_LIBRARY.find((t) => t.key === templateKey);
    if (!template) return;
    console.log("Adding node from template:", templateKey, template);
    setState((prev) => {
      const newNode: BuilderNode = {
        id: `node_${nanoid(6)}`,
        nodeType: template.nodeType,
        category: template.category,
        config: { ...template.defaultConfig },
        position: { x: 120 + prev.nodes.length * 40, y: 120 + prev.nodes.length * 30 },
      };
      console.log("New state nodes count:", prev.nodes.length + 1, newNode);
      return { ...prev, nodes: [...prev.nodes, newNode] };
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
      <div className="container mx-auto py-6 px-4 max-w-screen-2xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-muted-foreground">Workflow Builder</p>
            <h1 className="text-2xl font-mono font-bold">{props.workflowName}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={handleExecute} disabled={executing}>
              {executing ? "Executing..." : "Execute Workflow"}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Workflow"}
            </Button>
          </div>
        </div>

        <Card className="mb-4">
          <CardContent className="py-3">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-mono text-xs text-muted-foreground">Test:</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    console.log("Test button clicked! Current state nodes:", state.nodes.length);
                  }}
                >
                  Test Click (check console)
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-mono text-xs text-muted-foreground">
                  Use the + Node palette on the canvas to add blocks.
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-8 space-y-2">
            <div
              className="border rounded-lg relative"
              style={{ height: "720px", width: "100%", background: "#000000" }}
            >
              <div className="absolute left-3 top-3 z-50 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="shadow"
                  onClick={() => setShowPalette((open) => !open)}
                >
                  {showPalette ? "Close palette" : "+ Add node"}
                </Button>
              </div>

              {showPalette && (
                <div className="absolute left-3 top-12 z-50 w-80 max-h-[480px] overflow-y-auto rounded-lg border bg-white shadow-xl">
                  <div className="flex items-center justify-between px-3 py-2 border-b">
                    <span className="text-sm font-semibold">Node library</span>
                    <Button variant="ghost" size="sm" onClick={() => setShowPalette(false)}>
                      Close
                    </Button>
                  </div>
                  <div className="p-3 grid grid-cols-1 gap-2">
                    {NODE_LIBRARY.map((tmpl) => (
                      <button
                        key={tmpl.key}
                        className="flex w-full items-center justify-between rounded border px-3 py-2 text-left text-sm hover:bg-slate-50"
                        onClick={() => {
                          addNode(tmpl.key);
                          setShowPalette(false);
                        }}
                      >
                        <span className="font-medium">{tmpl.label}</span>
                        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          {tmpl.category}
                        </span>
                      </button>
                    ))}
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
                onConnect={(connection) => {
                  console.log('🔗 onConnect called:', connection);
                  console.log('🔗 Current nodes:', flowNodes.map(n => n.id));
                  console.log('🔗 Current edges before:', flowEdges);
                  onConnect(connection);
                }}
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
                nodesDraggable={true}
                nodesConnectable={true}
                elementsSelectable={true}
              >
                <Background color="#303030" />
                <Controls />
              </ReactFlow>
              <div className="px-3 py-2 border-t bg-muted/40 text-xs text-muted-foreground space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono">Nodes: {state.nodes.length}</span>
                  <span className="font-mono">Edges: {state.edges.length}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => flowInstance?.fitView({ padding: 0.2 })}
                  >
                    Fit view
                  </Button>
                </div>
                {state.nodes.length > 0 && (
                  <div className="flex flex-wrap gap-3">
                    {state.nodes.slice(0, 8).map((n) => (
                      <span key={n.id} className="font-mono text-[10px]">
                        {n.id}: ({Math.round(n.position.x)}, {Math.round(n.position.y)})
                      </span>
                    ))}
                    {state.nodes.length > 8 && <span className="font-mono text-[10px]">…</span>}
                  </div>
                )}
              </div>
            </div>

            {/* Debug: List all nodes as text */}
            {state.nodes.length > 0 && (
              <Card className="bg-amber-50 border-amber-200">
                <CardHeader className="py-2">
                  <CardTitle className="text-xs">📍 Debug: Nodes in State</CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-1">
                  {state.nodes.map((n) => (
                    <div key={n.id} className="font-mono">
                      <strong>{n.id}</strong> ({n.nodeType})
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="col-span-4 space-y-4">
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

        <div className="mt-6 text-xs text-muted-foreground font-mono">
          <p>Tips:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Only one trigger should exist. Save validates via backend.</li>
            <li>Use conditions (true/false) on edges from logic nodes.</li>
            <li>HTTP body/headers accept JSON; invalid JSON saves as raw string.</li>
          </ul>
        </div>
      </div>
    </ReactFlowProvider>
  );
}

export default function WorkflowBuilderClient(props: WorkflowBuilderClientProps) {
  return <WorkflowBuilderShell {...props} />;
}
