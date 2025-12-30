import { workflowDefinitionSchema, type WorkflowDefinition, type WorkflowNode } from "./schema";
import { getNode, hasNode } from "../nodes/registry";

// Using a custom error class keeps API handlers from leaking Zod internals to clients.
export class WorkflowValidationError extends Error {
  details: string[];

  constructor(message: string, details: string[] = []) {
    super(message);
    this.name = "WorkflowValidationError";
    this.details = details;
  }
}

export function validateWorkflowDefinition(definition: unknown): WorkflowDefinition {
  const parsed = workflowDefinitionSchema.safeParse(definition);
  if (!parsed.success) {
    const shapeIssues = parsed.error.errors.map((err) => err.message);
    throw new WorkflowValidationError("Workflow definition has an invalid shape", shapeIssues);
  }

  const workflow = parsed.data;
  const issues: string[] = [];

  // Validate node IDs are unique
  const nodeIds = new Set<string>();
  for (const node of workflow.nodes) {
    if (nodeIds.has(node.id)) {
      issues.push(`Duplicate node id: ${node.id}`);
    } else {
      nodeIds.add(node.id);
    }
  }

  // Validate node types exist in registry and configs are valid
  const triggerNodes: WorkflowNode[] = [];
  for (const node of workflow.nodes) {
    // Check if node type is registered
    if (!hasNode(node.type)) {
      issues.push(`Unknown node type: ${node.type}`);
      continue; // Skip further validation for this node
    }

    // Get node definition from registry
    const nodeDef = getNode(node.type);

    // Validate node config against schema
    const configValidation = nodeDef.configSchema.safeParse(node.config);
    if (!configValidation.success) {
      const configErrors = configValidation.error.errors
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join(", ");
      issues.push(`Node ${node.id} (${node.type}) has invalid config: ${configErrors}`);
    }

    // Track trigger nodes using registry category
    if (nodeDef.category === "trigger") {
      triggerNodes.push(node);
    }
  }

  // Ensure exactly one trigger
  if (triggerNodes.length !== 1) {
    issues.push(
      triggerNodes.length === 0
        ? "Workflow must contain exactly one trigger node"
        : `Workflow has ${triggerNodes.length} trigger nodes; only one is allowed`,
    );
  }

  // Validate edge references
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
