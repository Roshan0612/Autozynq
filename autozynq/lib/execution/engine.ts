import { prisma } from "../prisma";
import { getNode } from "../nodes/registry";
import { WorkflowDefinition, WorkflowNode, WorkflowEdge } from "../workflow/schema";
import { NodeContext } from "../nodes/base";

// ============================================================================
// TYPES
// ============================================================================

export interface RunWorkflowParams {
  workflowId: string;
  userId?: string;
  triggerInput?: unknown;
}

export interface ExecutionStep {
  nodeId: string;
  status: "running" | "success" | "failed";
  startedAt: string;
  finishedAt?: string;
  output?: unknown;
  error?: string;
}

export interface ExecutionError {
  message: string;
  nodeId?: string;
  stepIndex?: number;
  stack?: string;
}

// ============================================================================
// EXECUTION ENGINE
// ============================================================================

/**
 * Execution Engine v1: Linear, deterministic workflow execution.
 * 
 * Responsibilities:
 * - Fetch and validate workflow is ACTIVE
 * - Create execution record
 * - Build topological order from graph
 * - Execute nodes sequentially
 * - Store execution state and outputs
 * - Handle failures cleanly
 * 
 * Assumptions:
 * - Single trigger node (validated at activation)
 * - Linear execution (no branching/parallelism)
 * - DAG structure (no cycles)
 * - Configs pre-validated at activation
 * 
 * @param params - Workflow execution parameters
 * @returns Execution ID
 */
export async function runWorkflow(params: RunWorkflowParams): Promise<string> {
  const { workflowId, userId, triggerInput } = params;

  // ============================================================================
  // STEP 1: Fetch and validate workflow
  // ============================================================================

  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
  });

  if (!workflow) {
    throw new Error(`Workflow not found: ${workflowId}`);
  }

  if (workflow.status !== "ACTIVE") {
    throw new Error(`Workflow is not active: ${workflowId} (status: ${workflow.status})`);
  }

  const definition = workflow.definition as WorkflowDefinition;

  // ============================================================================
  // STEP 2: Create execution record
  // ============================================================================

  const execution = await prisma.execution.create({
    data: {
      workflowId,
      userId: userId || workflow.userId,
      status: "RUNNING",
      startedAt: new Date(),
      steps: [],
    },
  });

  const executionId = execution.id;
  const steps: ExecutionStep[] = [];

  try {
    // ============================================================================
    // STEP 3: Build execution order (topological sort)
    // ============================================================================

    const orderedNodes = buildExecutionOrder(definition.nodes, definition.edges);

    // ============================================================================
    // STEP 4: Execute nodes sequentially
    // ============================================================================

    let previousOutput: unknown = triggerInput || null;

    for (let stepIndex = 0; stepIndex < orderedNodes.length; stepIndex++) {
      const node = orderedNodes[stepIndex];
      const stepStart = new Date();

      // Create step record
      const step: ExecutionStep = {
        nodeId: node.id,
        status: "running",
        startedAt: stepStart.toISOString(),
      };

      steps.push(step);

      // Update execution with current progress
      await prisma.execution.update({
        where: { id: executionId },
        data: { steps: steps as any },
      });

      try {
        // ============================================================================
        // STEP 5: Execute node
        // ============================================================================

        // Get node definition from registry
        const nodeDef = getNode(node.type);

        // Build execution context
        const ctx: NodeContext = {
          input: previousOutput,
          config: node.config,
          auth: {}, // TODO: Load user's OAuth tokens when auth is implemented
          executionId,
          workflowId,
          userId: userId || workflow.userId,
          stepIndex,
        };

        // Execute node
        const output = await nodeDef.run(ctx);

        // Validate output against schema (defensive check)
        nodeDef.outputSchema.parse(output);

        // Store output for next step
        previousOutput = output;

        // Update step record
        step.status = "success";
        step.finishedAt = new Date().toISOString();
        step.output = output;

        // Update execution with step progress
        await prisma.execution.update({
          where: { id: executionId },
          data: { steps: steps as any },
        });
      } catch (error) {
        // Node execution failed
        step.status = "failed";
        step.finishedAt = new Date().toISOString();
        step.error = error instanceof Error ? error.message : String(error);

        // Update execution with failed step
        await prisma.execution.update({
          where: { id: executionId },
          data: { steps: steps as any },
        });

        // Rethrow to fail entire execution
        throw new Error(
          `Node ${node.id} (${node.type}) failed at step ${stepIndex}: ${step.error}`
        );
      }
    }

    // ============================================================================
    // STEP 6: Mark execution as successful
    // ============================================================================

    await prisma.execution.update({
      where: { id: executionId },
      data: {
        status: "SUCCESS",
        finishedAt: new Date(),
        result: previousOutput as any,
        steps: steps as any,
      },
    });

    return executionId;
  } catch (error) {
    // ============================================================================
    // STEP 7: Handle execution failure
    // ============================================================================

    const executionError: ExecutionError = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    };

    // Extract nodeId and stepIndex from error message if available
    const match = error instanceof Error ? error.message.match(/Node (\S+).*step (\d+)/) : null;
    if (match) {
      executionError.nodeId = match[1];
      executionError.stepIndex = parseInt(match[2], 10);
    }

    await prisma.execution.update({
      where: { id: executionId },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        error: executionError as any,
        steps: steps as any,
      },
    });

    // Don't crash the server - error is stored in execution record
    throw error;
  }
}

// ============================================================================
// GRAPH RESOLUTION
// ============================================================================

/**
 * Build topological execution order from workflow graph.
 * 
 * Algorithm:
 * 1. Find trigger node (no incoming edges)
 * 2. Perform topological sort using Kahn's algorithm
 * 3. Validate result is a valid linear order
 * 
 * @param nodes - Workflow nodes
 * @param edges - Workflow edges
 * @returns Nodes in execution order
 */
function buildExecutionOrder(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  // Build adjacency structures
  const nodeMap = new Map<string, WorkflowNode>();
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  // Initialize maps
  for (const node of nodes) {
    nodeMap.set(node.id, node);
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  // Build graph
  for (const edge of edges) {
    adjacency.get(edge.from)!.push(edge.to);
    inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
  }

  // Find trigger node (in-degree = 0)
  const triggerNodes = nodes.filter((node) => inDegree.get(node.id) === 0);

  if (triggerNodes.length === 0) {
    throw new Error("No trigger node found (all nodes have incoming edges)");
  }

  if (triggerNodes.length > 1) {
    throw new Error(
      `Multiple trigger nodes found: ${triggerNodes.map((n) => n.id).join(", ")}`
    );
  }

  // Topological sort using Kahn's algorithm
  const queue: string[] = [triggerNodes[0].id];
  const result: WorkflowNode[] = [];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const nodeId = queue.shift()!;

    // Skip if already visited (shouldn't happen in DAG, but defensive)
    if (visited.has(nodeId)) {
      continue;
    }

    visited.add(nodeId);
    result.push(nodeMap.get(nodeId)!);

    // Add children to queue when all dependencies are met
    const children = adjacency.get(nodeId) || [];
    for (const childId of children) {
      // Decrement in-degree
      const newDegree = (inDegree.get(childId) || 0) - 1;
      inDegree.set(childId, newDegree);

      // If all dependencies met, add to queue
      if (newDegree === 0) {
        queue.push(childId);
      }
    }
  }

  // Validate we processed all nodes (detect cycles)
  if (result.length !== nodes.length) {
    const missing = nodes.filter((n) => !visited.has(n.id)).map((n) => n.id);
    throw new Error(
      `Graph contains cycles or disconnected nodes. Missing nodes: ${missing.join(", ")}`
    );
  }

  return result;
}
