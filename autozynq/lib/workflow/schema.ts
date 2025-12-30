import { z } from "zod";

// Generic node + edge schema keeps execution engine flexible without DB migrations.
export const workflowNodeSchema = z.object({
  id: z.string().min(1, "Node id is required"),
  type: z.string().min(1, "Node type is required"),
  config: z.record(z.any()).default({}),
});

export const workflowEdgeSchema = z.object({
  from: z.string().min(1, "Edge 'from' is required"),
  to: z.string().min(1, "Edge 'to' is required"),
});

export const workflowDefinitionSchema = z.object({
  nodes: z.array(workflowNodeSchema).min(1, "Workflow needs at least one node"),
  edges: z.array(workflowEdgeSchema).default([]),
});

export type WorkflowNode = z.infer<typeof workflowNodeSchema>;
export type WorkflowEdge = z.infer<typeof workflowEdgeSchema>;
export type WorkflowDefinition = z.infer<typeof workflowDefinitionSchema>;
