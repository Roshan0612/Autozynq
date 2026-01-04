import { prisma } from "../prisma";
import { getNode } from "../nodes/registry";
import { WorkflowDefinition, WorkflowNode, WorkflowEdge } from "../workflow/schema";
import { NodeContext } from "../nodes/base";
import {
  acquireExecutionLock,
  releaseExecutionLock,
  WorkflowLockedError,
  LockAcquisitionFailedError,
} from "./lock";

// ============================================================================
// TYPES
// ============================================================================

export interface RunWorkflowParams {
  workflowId: string;
  userId?: string;
  triggerInput?: unknown;
  idempotencyKey?: string; // Optional idempotency key for duplicate prevention
}

export interface ExecutionStep {
  nodeId: string;
   nodeType: string; // Added for better debugging
  status: "running" | "success" | "skipped" | "failed"; // Added "skipped" for branching
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
 * Execution Engine v2: Linear deterministic workflow execution with branching support.
 * 
 * Responsibilities:
 * - Fetch and validate workflow is ACTIVE
 * - Create execution record
 * - Runtime traversal with conditional edge evaluation
 * - Support logic nodes for branching
 * - Execute nodes sequentially (one path at a time)
 * - Store execution state and outputs
 * - Handle failures cleanly
 * 
 * Assumptions:
 * - Single trigger node (validated at activation)
 * - Linear execution per path (no parallelism)
 * - DAG structure (no cycles)
 * - Configs pre-validated at activation
 * 
 * Backward Compatibility:
 * - Workflows without logic nodes execute as v1 (linear order)
 * - Conditional edges are optional on all edges
 * 
 * @param params - Workflow execution parameters
 * @returns Execution ID
 */
export async function runWorkflow(params: RunWorkflowParams): Promise<string> {
  const { workflowId, userId, triggerInput, idempotencyKey } = params;

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
  // STEP 2: Create execution record (with idempotency check)
  // ============================================================================

  let execution;
  
  try {
    execution = await prisma.execution.create({
      data: {
        workflowId,
        userId: userId || workflow.userId,
        status: "RUNNING",
        startedAt: new Date(),
        steps: [],
        idempotencyKey: idempotencyKey || undefined,
      },
    });
  } catch (error: any) {
    // Handle idempotency key constraint violation
    if (error.code === "P2002" && error.meta?.target?.includes("idempotencyKey")) {
      // Another request with same idempotency key succeeded, fetch that execution
      const existingExecution = await prisma.execution.findUnique({
        where: { idempotencyKey },
      });
      
      if (existingExecution) {
        console.log(
          `[Engine] Idempotency key collision detected. Returning existing execution: ${existingExecution.id}`
        );
        return existingExecution.id;
      }
    }
    
    // Not an idempotency issue, rethrow
    throw error;
  }

  const executionId = execution.id;
  const steps: ExecutionStep[] = [];
  const executedNodeIds = new Set<string>(); // Track which nodes have executed
  const nodeOutputs = new Map<string, unknown>(); // Store outputs for each node

  // ============================================================================
  // STEP 3: Attempt to acquire execution lock
  // ============================================================================

  let lockResult: Awaited<ReturnType<typeof acquireExecutionLock>> | null = null;

  try {
    lockResult = await acquireExecutionLock(workflowId, executionId);
    console.log(
      `[Engine] Acquired execution lock for workflow ${workflowId} (execution: ${executionId})`
    );
  } catch (lockError) {
    // Lock acquisition failed - execution cannot proceed
    // This is a concurrency control response, NOT a system error

    if (lockError instanceof WorkflowLockedError) {
      // Another execution is currently running
      console.warn(
        `[Engine] Lock acquisition failed: Workflow ${workflowId} is currently executing (${lockError.existingExecutionId})`
      );

      // Clean up the execution record we just created (it's unused)
      await prisma.execution.delete({
        where: { id: executionId },
      });

      // Re-throw with existing execution ID
      throw lockError;
    }

    if (lockError instanceof LockAcquisitionFailedError) {
      // Concurrent request beat us to the lock
      console.warn(`[Engine] Lock acquisition failed due to concurrent request`);

      // Clean up the execution record
      await prisma.execution.delete({
        where: { id: executionId },
      });

      throw lockError;
    }

    // Some other error, rethrow
    throw lockError;
  }

  try {
    // ============================================================================
    // STEP 3: Build execution graph (adjacency structures)
    // ============================================================================

    const graph = buildExecutionGraph(definition.nodes, definition.edges);

    // ============================================================================
    // STEP 4: Execute nodes via runtime traversal
    // ============================================================================

    // Start at trigger node
    let currentNodeId: string | null = graph.triggerNodeId;
    let previousOutput: unknown = triggerInput || null;
    let iterationCount = 0;
    const MAX_ITERATIONS = definition.nodes.length * 2; // Safety limit

    while (currentNodeId) {
      // ============================================================================
      // ENGINE GUARD: Check for cancellation before each node
      // ============================================================================
      
      const currentExecution = await prisma.execution.findUnique({
        where: { id: executionId },
        select: { status: true },
      });

      if (!currentExecution) {
        throw new Error(`Execution record not found: ${executionId}`);
      }

      // If execution is not RUNNING, abort immediately
      if (currentExecution.status !== "RUNNING") {
        console.log(
          `[Engine Guard] Execution ${executionId} status is ${currentExecution.status}. Aborting execution.`
        );

        // Mark remaining nodes as skipped
        const remainingNodes = Array.from(graph.nodeMap.keys()).filter(
          (nodeId) => !executedNodeIds.has(nodeId)
        );

        for (const nodeId of remainingNodes) {
          const node = graph.nodeMap.get(nodeId);
          if (node) {
            steps.push({
              nodeId: node.id,
              nodeType: node.type,
              status: "skipped",
              startedAt: new Date().toISOString(),
              finishedAt: new Date().toISOString(),
            });
          }
        }

        // Finalize execution as ABORTED
        await prisma.execution.update({
          where: { id: executionId },
          data: {
            status: "ABORTED",
            finishedAt: new Date(),
            steps: steps as any,
          },
        });

        // Release lock before returning
        if (lockResult) {
          await releaseExecutionLock(workflowId, executionId);
        }

        // Return execution ID (don't throw error - this is a clean abort)
        return executionId;
      }

      // Safety: Detect infinite loops
      iterationCount++;
      if (iterationCount > MAX_ITERATIONS) {
        throw new Error(
          `Execution exceeded maximum iterations (${MAX_ITERATIONS}). Possible cycle detected.`
        );
      }

      // Check if we've already executed this node (cycle detection)
      if (executedNodeIds.has(currentNodeId)) {
        throw new Error(
          `Cycle detected: Node ${currentNodeId} has already been executed. ` +
          `Execution path: ${Array.from(executedNodeIds).join(" → ")}`
        );
      }

      executedNodeIds.add(currentNodeId);

      const node = graph.nodeMap.get(currentNodeId);
      if (!node) {
        throw new Error(`Node not found in graph: ${currentNodeId}`);
      }

      const stepStart = new Date();

      // Create step record
      const step: ExecutionStep = {
        nodeId: node.id,
        nodeType: node.type,
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

        // Validate node exists in registry (defensive check)
        let nodeDef;
        try {
          nodeDef = getNode(node.type);
        } catch (error) {
          throw new Error(
            `Node type not found in registry: ${node.type}. ` +
            `Available types: ${Object.keys(require("../nodes/registry").nodeRegistry).join(", ")}`
          );
        }

        // Build execution context
        const ctx: NodeContext = {
          input: previousOutput,
          config: node.config,
          auth: {},
          executionId,
          workflowId,
          userId: userId || workflow.userId,
          stepIndex: steps.length - 1,
        };

        // Execute node
        const output = await nodeDef.run(ctx);

        // Validate output against schema (defensive check)
        nodeDef.outputSchema.parse(output);

        // Store output for next step or as final result
        previousOutput = output;
        nodeOutputs.set(node.id, output);

        // Update step record
        step.status = "success";
        step.finishedAt = new Date().toISOString();
        step.output = output;

        // Update execution with step progress
        await prisma.execution.update({
          where: { id: executionId },
          data: { steps: steps as any },
        });

        // ============================================================================
        // STEP 6: Determine next node based on edges and logic node output
        // ============================================================================

        const nextNodeId = getNextNode(
          currentNodeId,
          output,
          nodeDef.category,
          graph
        );

        currentNodeId = nextNodeId;
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
          `Node ${node.id} (${node.type}) failed at step ${steps.length - 1}: ${step.error}`
        );
      }
    }

    // ============================================================================
    // STEP 7: Mark execution as successful
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

    // Release lock on successful completion
    if (lockResult) {
      await releaseExecutionLock(workflowId, executionId);
    }

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

    // Release lock on failure
    if (lockResult) {
      await releaseExecutionLock(workflowId, executionId);
    }

    // Don't crash the server - error is stored in execution record
    throw error;
  }
}

// ============================================================================
// GRAPH RESOLUTION (v2 - Runtime Traversal)
// ============================================================================

/**
 * Execution graph structure for v2 runtime traversal.
 */
interface ExecutionGraph {
  nodeMap: Map<string, WorkflowNode>;
  adjacency: Map<string, Array<{ targetId: string; condition?: string }>>;
  triggerNodeId: string;
}

/**
 * Build execution graph structure for runtime traversal.
 * 
 * Returns adjacency map that tracks outgoing edges with optional conditions.
 * Validates trigger node exists but does not enforce topological order.
 * 
 * SAFETY CHECKS:
 * - Validates all edge endpoints exist
 * - Detects missing nodes
 * - Ensures exactly one trigger node
 * - Validates graph connectivity
 * 
 * @param nodes - Workflow nodes
 * @param edges - Workflow edges with optional conditions
 * @returns ExecutionGraph for runtime traversal
 */
function buildExecutionGraph(nodes: WorkflowNode[], edges: WorkflowEdge[]): ExecutionGraph {
  const nodeMap = new Map<string, WorkflowNode>();
  const adjacency = new Map<string, Array<{ targetId: string; condition?: string }>>();
  const inDegree = new Map<string, number>();

  // Safety: Validate nodes array is not empty
  if (nodes.length === 0) {
    throw new Error("Workflow must have at least one node");
  }

  // Initialize maps
  for (const node of nodes) {
    // Safety: Validate node has required fields
    if (!node.id || !node.type) {
      throw new Error(
        `Invalid node: missing id or type. Node: ${JSON.stringify(node)}`
      );
    }

    nodeMap.set(node.id, node);
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  // Build adjacency with conditions
  for (const edge of edges) {
    // Safety: Validate edge endpoints exist
    if (!nodeMap.has(edge.from)) {
      throw new Error(
        `Invalid edge: source node "${edge.from}" does not exist. ` +
        `Available nodes: ${Array.from(nodeMap.keys()).join(", ")}`
      );
    }
    if (!nodeMap.has(edge.to)) {
      throw new Error(
        `Invalid edge: target node "${edge.to}" does not exist. ` +
        `Available nodes: ${Array.from(nodeMap.keys()).join(", ")}`
      );
    }

    const edgeWithCondition: { targetId: string; condition?: string } = {
      targetId: edge.to,
    };
    if (edge.condition) {
      edgeWithCondition.condition = edge.condition;
    }
    adjacency.get(edge.from)!.push(edgeWithCondition);
    inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
  }

  // Find trigger node (no incoming edges)
  const triggerNodes = nodes.filter((node) => inDegree.get(node.id) === 0);

  if (triggerNodes.length === 0) {
    throw new Error(
      "No trigger node found. Every workflow must have exactly one node " +
      "with no incoming edges (the entry point). All nodes have incoming edges."
    );
  }

  if (triggerNodes.length > 1) {
    throw new Error(
      `Multiple trigger nodes found: ${triggerNodes.map((n) => n.id).join(", ")}. ` +
      `Workflow must have exactly one trigger node (entry point).`
    );
  }

  return {
    nodeMap,
    adjacency,
    triggerNodeId: triggerNodes[0].id,
  };
}

/**
 * Determine next node to execute based on:
 * 1. Outgoing edges from current node
 * 2. If current node is logic node, evaluate its output
 * 3. Match edge conditions with output
 * 
 * Returns null if no next node (execution terminates).
 * 
 * SAFETY:
 * - Throws if multiple edges match (ambiguous routing)
 * - Throws if logic node output is malformed
 * - Returns null if no edges match (clean termination)
 * 
 * @param currentNodeId - ID of node that just executed
 * @param output - Output from the executed node
 * @param nodeCategory - Category of the executed node
 * @param graph - Execution graph
 * @returns Next node ID, or null if execution should terminate
 */
function getNextNode(
  currentNodeId: string,
  output: unknown,
  nodeCategory: string,
  graph: ExecutionGraph
): string | null {
  const outgoingEdges = graph.adjacency.get(currentNodeId) || [];

  if (outgoingEdges.length === 0) {
    // No outgoing edges - execution terminates cleanly
    return null;
  }

  // For logic nodes, output must have { outcome: string }
  if (nodeCategory === "logic") {
    if (typeof output !== "object" || output === null || !("outcome" in output)) {
      throw new Error(
        `Logic node ${currentNodeId} output must have "outcome" field. ` +
        `Got: ${JSON.stringify(output)}`
      );
    }

    const logicOutput = output as { outcome: string };
    const outcome = logicOutput.outcome;

    // Find all edges that match the outcome
    const matchingEdges = outgoingEdges.filter((edge) => {
      // Logic nodes require conditional edges
      if (!edge.condition) return false;
      // Match outcome with condition
      return edge.condition === outcome;
    });

    // Safety: Detect ambiguous routing
    if (matchingEdges.length > 1) {
      throw new Error(
        `Ambiguous routing detected for logic node ${currentNodeId}. ` +
        `Multiple edges match outcome "${outcome}": ` +
        `${matchingEdges.map((e) => e.targetId).join(", ")}. ` +
        `Each outcome must map to exactly one target node.`
      );
    }

    // No match = clean termination (not an error)
    if (matchingEdges.length === 0) {
      return null;
    }

    return matchingEdges[0].targetId;
  }

  // For non-logic nodes (trigger/action), follow first unconditional edge
  const unconditionalEdges = outgoingEdges.filter((edge) => !edge.condition);

  // Safety: Warn if non-logic node has conditional edges (likely misconfiguration)
  const conditionalEdges = outgoingEdges.filter((edge) => edge.condition);
  if (conditionalEdges.length > 0 && unconditionalEdges.length === 0) {
    console.warn(
      `[Engine Warning] Non-logic node ${currentNodeId} (category: ${nodeCategory}) ` +
      `has only conditional edges. These will be ignored. ` +
      `Conditional edges should only be used with logic nodes.`
    );
    // Terminate cleanly rather than following conditional edges
    return null;
  }

  // Safety: Detect multiple unconditional edges (ambiguous routing)
  if (unconditionalEdges.length > 1) {
    throw new Error(
      `Ambiguous routing detected for node ${currentNodeId}. ` +
      `Multiple unconditional edges found: ` +
      `${unconditionalEdges.map((e) => e.targetId).join(", ")}. ` +
      `Non-logic nodes must have exactly one unconditional outgoing edge.`
    );
  }

  // Follow the single unconditional edge, or terminate if none exist
  return unconditionalEdges[0]?.targetId || null;
}

// ============================================================================
// LEGACY v1 GRAPH RESOLUTION (kept for reference if needed)
// ============================================================================

/**
 * Build topological execution order from workflow graph (v1 approach).
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

  // Build graph (ignore conditions for v1)
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
