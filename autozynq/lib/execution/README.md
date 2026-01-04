# Execution Engine v1

**Linear, deterministic workflow execution for Autozynq automation platform**

---

## 🎯 Overview

The Execution Engine is the core component that runs activated workflows safely and deterministically. It processes workflow definitions, executes nodes in topological order, and maintains execution state throughout the process.

## 🏗️ Architecture

### Core Components

1. **`runWorkflow()`** - Main entry point for workflow execution
2. **`buildExecutionOrder()`** - Topological sort for DAG resolution
3. **Execution persistence** - Progressive state updates in PostgreSQL
4. **Error handling** - Graceful failure with detailed error tracking

### Data Flow

```
┌─────────────────┐
│  runWorkflow()  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Fetch Workflow  │ ◄── Assert ACTIVE status
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Create Execution│ ◄── status = RUNNING
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Build Exec Order│ ◄── Topological sort
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Execute Nodes  │ ◄── Sequential loop
│   Sequentially  │
└────────┬────────┘
         │
    ┌────┴─────┐
    │          │
    ▼          ▼
┌────────┐ ┌────────┐
│SUCCESS │ │ FAILED │
└────────┘ └────────┘
```

## 📦 Usage

### Basic Example

```typescript
import { runWorkflow } from "@/lib/execution/engine";

// Execute an active workflow
const executionId = await runWorkflow({
  workflowId: "cm...",
  userId: "cm...",
  triggerInput: {
    // Optional: override trigger data
    subject: "Custom trigger data",
  },
});

console.log("Execution ID:", executionId);
```

### With Error Handling

```typescript
try {
  const executionId = await runWorkflow({
    workflowId: workflow.id,
    userId: user.id,
  });

  // Fetch execution details
  const execution = await prisma.execution.findUnique({
    where: { id: executionId },
  });

  console.log("Status:", execution.status);
  console.log("Result:", execution.result);
} catch (error) {
  console.error("Execution failed:", error.message);
  // Error details are stored in Execution.error
}
```

## 🔄 Execution Lifecycle

### 1. Initialization
- Fetch workflow from database
- Validate workflow status is `ACTIVE`
- Create execution record with `RUNNING` status

### 2. Graph Resolution
- Build topological order using Kahn's algorithm
- Validate single trigger node
- Detect cycles and disconnected nodes

### 3. Node Execution
For each node in order:
1. Retrieve node definition from registry
2. Build `NodeContext` with input, config, and metadata
3. Execute `node.run(ctx)`
4. Validate output against schema
5. Store output for next step
6. Update execution steps in database

### 4. Finalization
**On Success:**
- Status → `SUCCESS`
- Store final result
- Set `finishedAt` timestamp

**On Failure:**
- Status → `FAILED`
- Store error details (message, nodeId, stepIndex)
- Set `finishedAt` timestamp

## 📊 Execution Model

### Execution Table Schema

```prisma
model Execution {
  id         String          @id @default(cuid())
  workflowId String
  userId     String?
  status     ExecutionStatus // PENDING | RUNNING | SUCCESS | FAILED
  startedAt  DateTime        @default(now())
  finishedAt DateTime?
  result     Json?           // Final output from last node
  error      Json?           // Error details if failed
  steps      Json?           // Step-by-step execution log
  
  workflow   Workflow        @relation(...)
}
```

### Step Log Format

```typescript
interface ExecutionStep {
  nodeId: string;
  status: "running" | "success" | "failed";
  startedAt: string;
  finishedAt?: string;
  output?: unknown;
  error?: string;
}
```

### Error Format

```typescript
interface ExecutionError {
  message: string;
  nodeId?: string;
  stepIndex?: number;
  stack?: string;
}
```

## 🧠 Design Principles

### 1. **Deterministic**
- Same workflow + same input = same result
- No randomness or side effects in execution flow

### 2. **Defensive**
- Validates workflow is ACTIVE before execution
- Checks node existence in registry
- Validates node outputs against schemas
- Detects invalid graphs (cycles, disconnected nodes)

### 3. **Transparent**
- Progressive execution logging
- Detailed error messages
- Full execution history in database

### 4. **Fail-Safe**
- Node failures don't crash the server
- Execution status always resolves
- Errors stored for debugging

## 🚫 Current Limitations (v1)

### Not Implemented (By Design)
- ❌ Parallel execution
- ❌ Branching / conditionals
- ❌ Retries
- ❌ Webhooks / triggers
- ❌ Background workers / queues
- ❌ Partial execution / checkpoints

These features are explicitly **out of scope** for v1. The engine is intentionally simple and boring.

## 🔐 Error Handling

### Execution-Level Errors
```typescript
// Workflow not found
throw new Error("Workflow not found: {id}");

// Workflow not active
throw new Error("Workflow is not active: {id} (status: {status})");

// Graph validation errors
throw new Error("Graph contains cycles or disconnected nodes");
```

### Node-Level Errors
```typescript
// Node execution failure
throw new Error("Node {id} ({type}) failed at step {index}: {error}");
```

All errors are caught, stored in `Execution.error`, and execution status is set to `FAILED`.

## 🧪 Testing

Run the test suite:

```bash
npx tsx scripts/test-execution-engine.ts
```

This creates a test workflow (Gmail → Slack) and executes it end-to-end.

## 🔮 Future Enhancements (Post-v1)

1. **Parallel Execution**: Execute independent branches concurrently
2. **Conditionals**: Branch based on node outputs
3. **Retries**: Configurable retry logic for failed nodes
4. **Webhooks**: HTTP triggers for external events
5. **Queue Workers**: BullMQ/Redis for async execution
6. **Checkpoints**: Resume execution from failed step

## 📚 Related Documentation

- [Workflow Schema](../workflow/README.md) - Workflow definition format
- [Node Registry](../nodes/README.md) - Creating automation nodes
- [Validation](../workflow/validate.ts) - Workflow validation rules

---

**Built for Autozynq - An n8n/Zapier-like automation platform**

---

# Execution Engine v2 (Branching & Conditions)

**Runtime traversal with conditional logic for decision-based automation workflows**

---

## 🎯 What Changed in v2

### v1 (Linear Execution)
- Static topological sort determines execution order upfront
- All nodes execute sequentially regardless of data
- No conditional logic or branching
- Simple but inflexible

### v2 (Runtime Traversal with Branching)
- **Runtime graph traversal** - next node chosen during execution
- **Conditional edges** - edges can specify when to follow
- **Logic nodes** - new node category for decision-making
- **Selective execution** - only taken path executes
- **Backward compatible** - v1 workflows run unchanged

## 🧩 New Concepts

### Logic Nodes

Logic nodes evaluate input and return routing decisions:

```typescript
{
  type: "logic.condition",
  category: "logic", // NEW category
  config: {
    operator: "greaterThan",
    value: 50
  },
  output: {
    outcome: "true" | "false" // Standard output format
  }
}
```

**Characteristics:**
- Pure evaluation (no side effects)
- Input → comparison → outcome
- Output must have `outcome` field
- Determines which outgoing edge to follow

### Conditional Edges

Edges can now specify conditions:

```typescript
{
  from: "logicNode",
  to: "targetNode",
  condition: "true" // Optional field
}
```

**Rules:**
- If `condition` is undefined → always follow (v1 behavior)
- If `condition` is defined → follow only if logic node outcome matches
- Non-logic nodes ignore conditions (follow first unconditional edge)

### Runtime Traversal

Instead of computing all nodes upfront, v2 walks the graph:

```
currentNode = triggerNode

while (currentNode exists):
  1. Execute currentNode
  2. Store output
  3. Evaluate outgoing edges
  4. Pick next node based on:
     - Logic node outcome (if logic category)
     - Edge conditions
  5. Set currentNode = nextNode
  6. If nextNode is null, terminate
```

## 🏗️ Architecture Changes

### ExecutionGraph Structure

```typescript
interface ExecutionGraph {
  nodeMap: Map<string, WorkflowNode>;
  adjacency: Map<string, Array<{ 
    targetId: string; 
    condition?: string; 
  }>>;
  triggerNodeId: string;
}
```

### Edge Evaluation Function

```typescript
function getNextNode(
  currentNodeId: string,
  output: unknown,
  nodeCategory: string,
  graph: ExecutionGraph
): string | null {
  const outgoingEdges = graph.adjacency.get(currentNodeId);
  
  if (nodeCategory === "logic") {
    // Match outcome with edge condition
    const { outcome } = output as { outcome: string };
    return edges.find(e => e.condition === outcome)?.targetId || null;
  } else {
    // Follow first unconditional edge
    return edges.find(e => !e.condition)?.targetId || null;
  }
}
```

### Execution Loop (v2)

```typescript
let currentNodeId: string | null = graph.triggerNodeId;

while (currentNodeId) {
  const node = graph.nodeMap.get(currentNodeId);
  const output = await executeNode(node);
  
  currentNodeId = getNextNode(
    currentNodeId, 
    output, 
    nodeDef.category, 
    graph
  );
}
```

## 📊 Branching Example

### Workflow Definition

```json
{
  "nodes": [
    {
      "id": "trigger1",
      "type": "test.trigger.passthrough",
      "config": {}
    },
    {
      "id": "if1",
      "type": "logic.condition",
      "config": {
        "operator": "greaterThan",
        "value": 50
      }
    },
    {
      "id": "action1",
      "type": "slack.action.sendMessage",
      "config": {
        "channel": "#alerts",
        "message": "High value detected!"
      }
    }
  ],
  "edges": [
    { "from": "trigger1", "to": "if1" },
    { "from": "if1", "to": "action1", "condition": "true" }
  ]
}
```

### Execution Trace (Input = 75)

```
Step 1: trigger1 (test.trigger.passthrough)
  Input: 75
  Output: 75
  Next: if1

Step 2: if1 (logic.condition)
  Input: 75
  Config: { operator: "greaterThan", value: 50 }
  Evaluation: 75 > 50 = true
  Output: { outcome: "true" }
  Edge matching: find edge with condition="true"
  Next: action1

Step 3: action1 (slack.action.sendMessage)
  Input: { outcome: "true" }
  Config: { channel: "#alerts", message: "High value detected!" }
  Output: { success: true, messageId: "msg_123", ... }
  Next: null (terminate)

Result: SUCCESS, 3 steps executed
```

### Execution Trace (Input = 30)

```
Step 1: trigger1 (test.trigger.passthrough)
  Input: 30
  Output: 30
  Next: if1

Step 2: if1 (logic.condition)
  Input: 30
  Config: { operator: "greaterThan", value: 50 }
  Evaluation: 30 > 50 = false
  Output: { outcome: "false" }
  Edge matching: no edge with condition="false"
  Next: null (terminate)

Result: SUCCESS, 2 steps executed (action1 not executed)
```

## 🔐 Execution Guarantees

### Determinism
- ✅ Same input → same execution path
- ✅ Same node execution order for same path
- ✅ Predictable branching behavior

### Safety
- ✅ Cycle detection (executed nodes tracked)
- ✅ Logic node output validation
- ✅ Graceful termination when no next node
- ✅ No infinite loops

### Logging
- ✅ Every executed node creates a step
- ✅ Skipped nodes don't appear in steps (by design)
- ✅ Node type included in step for debugging
- ✅ Full input/output captured per step

## 🧪 Testing

Run Engine v2 branching tests:

```bash
npx tsx scripts/test-engine-v2.ts
```

Tests cover:
1. True branch execution (input > 50)
2. False branch execution (input < 50)
3. Linear workflow backward compatibility

All tests must pass with ✅ status.

## 🚫 Still Out of Scope (v2)

- ❌ **Parallel execution** - Multiple branches at once
- ❌ **Retries** - Automatic retry on failure
- ❌ **Loops** - Repeat until condition met
- ❌ **Switch nodes** - Multi-way branching (>2 outcomes)
- ❌ **Nested conditions** - If inside if
- ❌ **Dynamic edges** - Runtime edge creation

These remain intentionally simple. Execution is sequential, deterministic, and fully logged.

## 🔮 Future Enhancements (Post-v2)

1. **Parallel Branches**: Execute independent paths concurrently
2. **Switch Node**: Multi-way routing (e.g., route by email domain)
3. **Loop Node**: Repeat until condition met or max iterations
4. **Filter Node**: Process arrays with conditional filtering
5. **Merge Node**: Wait for multiple branches to complete

## 📚 Available Logic Nodes

### `logic.condition`
**Purpose**: If/else branching based on comparison

**Config:**
```typescript
{
  operator: "equals" | "notEquals" | "greaterThan" | "lessThan" | "contains",
  value: any
}
```

**Output:**
```typescript
{
  outcome: "true" | "false"
}
```

**Supported Operators:**
- `equals`: Input === value
- `notEquals`: Input !== value
- `greaterThan`: Input > value (numeric comparison)
- `lessThan`: Input < value (numeric comparison)
- `contains`: Input.includes(value) (string or array)

**Example:**
```json
{
  "id": "checkPriority",
  "type": "logic.condition",
  "config": {
    "operator": "contains",
    "value": "urgent"
  }
}
```

## 📝 Migration Guide

### From v1 to v2

**No changes required for existing workflows.** v1 linear workflows execute unchanged in v2.

### Adding Branching to Workflows

1. **Add logic node to definition:**
   ```json
   {
     "id": "if1",
     "type": "logic.condition",
     "config": { "operator": "greaterThan", "value": 50 }
   }
   ```

2. **Add conditional edges:**
   ```json
   { "from": "if1", "to": "highValueAction", "condition": "true" },
   { "from": "if1", "to": "lowValueAction", "condition": "false" }
   ```

3. **Test execution paths:**
   - Trigger with high value → verify `highValueAction` executes
   - Trigger with low value → verify `lowValueAction` executes
   - Check execution steps show only taken path

## 🐛 Debugging Branching Workflows

### Common Issues

**Problem**: Logic node always returns false
- **Check**: Input type matches operator (e.g., `greaterThan` needs number)
- **Check**: Config value is correct type

**Problem**: Action after logic node never executes
- **Check**: Edge condition matches logic node outcome
- **Check**: Edge exists for desired outcome

**Problem**: Execution terminates early
- **Expected**: If no edge matches outcome, execution terminates cleanly
- **Solution**: Add edge with matching condition, or add default path

### Debugging Steps

1. View execution in `/executions/[id]`
2. Check each step's output
3. Find logic node step → check `outcome` value
4. Verify edge with matching `condition` exists
5. If next node missing → expected behavior (path not taken)

---

**Built for Autozynq - Boring, deterministic, fully logged automation**
