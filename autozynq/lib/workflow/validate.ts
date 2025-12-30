import { workflowDefinitionSchema, type WorkflowDefinition, type WorkflowNode } from "./schema";

// Using a custom error class keeps API handlers from leaking Zod internals to clients.
export class WorkflowValidationError extends Error {
  details: string[];

  constructor(message: string, details: string[] = []) {
    super(message);
    this.name = "WorkflowValidationError";
    this.details = details;
  }
}

const isTriggerNode = (node: WorkflowNode) =>
  node.type.includes(".trigger.") || node.type.endsWith(".trigger");

export function validateWorkflowDefinition(definition: unknown): WorkflowDefinition {
  const parsed = workflowDefinitionSchema.safeParse(definition);
  if (!parsed.success) {
    const shapeIssues = parsed.error.errors.map((err) => err.message);
    throw new WorkflowValidationError("Workflow definition has an invalid shape", shapeIssues);
  }

  const workflow = parsed.data;
  const issues: string[] = [];

  const nodeIds = new Set<string>();
  for (const node of workflow.nodes) {
    if (nodeIds.has(node.id)) {
      issues.push(`Duplicate node id: ${node.id}`);
    } else {
      nodeIds.add(node.id);
    }
  }

  const triggerNodes = workflow.nodes.filter(isTriggerNode);
  if (triggerNodes.length !== 1) {
    issues.push(
      triggerNodes.length === 0
        ? "Workflow must contain exactly one trigger node"
        : `Workflow has ${triggerNodes.length} trigger nodes; only one is allowed`,
    );
  }

  for (const edge of workflow.edges) {
    if (!nodeIds.has(edge.from)) {
      issues.push(`Edge 'from' references missing node: ${edge.from}`);
    }
    if (!nodeIds.has(edge.to)) {
      issues.push(`Edge 'to' references missing node: ${edge.to}`);
    }
  }

  if (issues.length > 0) {
    throw new WorkflowValidationError("Workflow definition failed semantic validation", issues);
  }

  return workflow;
}
