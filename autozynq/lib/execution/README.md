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
