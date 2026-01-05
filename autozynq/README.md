# Autozynq

A Next.js app with Prisma + NextAuth (GitHub/Google), Tailwind v3, and shadcn-style components.

## Overview
- Foundation: Next.js 15.5.9 (App Router), Prisma v5, NextAuth v4
- Database: Neon PostgreSQL
- UI: Tailwind v3, Radix UI wrappers, lucide-react icons
- Theme: next-themes with global ThemeProvider

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment:
   - .env / .env.local: DATABASE_URL, NEXTAUTH_URL, NEXTAUTH_SECRET, GitHub/Google OAuth keys
3. Generate Prisma client:
   ```bash
   npx prisma generate
   ```
4. Run dev server:
   ```bash
   npm run dev
   ```

## Latest Test Run
- Date: 2026-01-05
- Command: `npx tsx scripts/test-engine-v2-hardened.ts`
- Result: 7 passed, 0 failed
- Coverage: Execution engine v2 branching safety (linear, true/false branches, unmatched edge termination, ambiguous routing detection, cycle detection, multiple unconditional edges)

## Auth
- Providers: GitHub + Google
- Persistence: Database session strategy via Prisma Adapter
- Prisma models include User.emailVerified and VerificationToken

## UI
- Components: Button, Tooltip, Dropdown Menu wrappers
- Navbar with centered links; Sidebar with tooltips; ModeToggle at bottom

## Known Issues & Resolutions
- Prisma v7 adapter runtime: Downgraded to Prisma v5 and standard client
- Tailwind v4 PostCSS error: Moved to Tailwind v3; fixed globals.css
- NextAuth account linking: Enabled, added missing models & DB sessions
- Route layout error: Added valid default export for (main)/layout

## Recent Changes
This section is auto-generated from docs/CHANGELOG.md by scripts/post-commit.js.

# Changelog

This file tracks notable changes, issues, and resolutions. The README is auto-generated from this changelog.

## 2025-12-22 — Day 1 Foundation
- Init Next.js App Router project
- Added NextAuth (GitHub provider) and session context
- Set up Neon PostgreSQL and Prisma init
- Protected /dashboard route and auth flow
- Issues: Prisma 7 config changes; resolved with prisma.config.ts

## 2025-12-26 — Stabilization & UI
- Downgraded Prisma to v5; simplified Prisma client
- NextAuth: Prisma Adapter + DB sessions; added `emailVerified` + `VerificationToken`
- Tailwind v3 setup; fixed `globals.css` syntax
- Added Navbar (centered links), Sidebar with tooltips, ModeToggle
- Cleaned `.env` duplication and Neon connection flags
- Issue: Settings route layout error; fixed `(main)/layout` default export

## 2025-12-27 — Layout & Automation
- Confirmed `(main)/layout.tsx` export remains valid after edits
- Added plan to auto-update README on each commit with Husky
## 2026-01-04 — Phase 2: Webhook Trigger System
### ✨ What's New
Converted Autozynq from a **workflow runner** into **real automation software** by implementing external event triggers.

### 🎯 Core Features Implemented
1. **TriggerSubscription Model**: New Prisma model for decoupled trigger event subscriptions
   - Unique `webhookPath` for each trigger
   - Tracks `executionCount` and `lastPayload` for debugging
   - Enables trigger history and analytics

2. **Webhook Endpoint** (`POST /api/webhooks/:webhookPath`)
   - Receives HTTP events from external systems
   - No authentication required (webhooks are public)
   - Validates payload is JSON object
   - Starts workflow execution via `runWorkflow()`

3. **Trigger Registration on Activation**
   - When workflow is activated, trigger node is detected
   - Unique `webhookPath` is generated
   - Stored in `TriggerSubscription` table
   - Deactivation removes all subscriptions

4. **Trigger Service Layer** (`/lib/triggers/subscriptions.ts`)
   - `createTriggerSubscription()` - Register webhook trigger
   - `getTriggerSubscriptionByPath()` - Webhook event lookup
   - `updateSubscriptionAfterExecution()` - Track payload & count
   - `getWorkflowSubscriptions()` - Trigger debugging UI

5. **Workflow Activation Layer** (`/lib/workflow/activation.ts`)
   - `activateWorkflow()` - Creates trigger subscription, returns webhook URL
   - `deactivateWorkflow()` - Deletes subscriptions, pauses workflow
   - Clean error handling with `WorkflowActivationError`

### 📊 Data Flow
```
External Event (HTTP)
  ↓ POST /api/webhooks/:webhookPath
  ↓ Lookup TriggerSubscription
  ↓ Verify workflow is ACTIVE
  ↓ Call runWorkflow(workflowId, userId, triggerInput: payload)
  ↓ Execution created with trigger data
  ↓ Steps contain webhook payload in context
  ↓ Execution count & lastPayload updated
  ↓ 200 OK response with execution ID
```

### 🔧 Technical Details
- **Payload Handling**: Webhook payload passed unchanged to execution engine
- **Error Safety**: All errors caught, execution record stores error details
- **Idempotency**: Webhook accepts same payload multiple times (creates separate executions)
- **Debugging**: UI pages display triggers, webhook URLs, payload history

### 📝 Schema Changes
```prisma
model TriggerSubscription {
  id            String    @id @default(cuid())
  workflowId    String
  nodeId        String
  triggerType   String    // "webhook"
  webhookPath   String    @unique
  lastPayload   Json?
  executionCount Int      @default(0)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  workflow      Workflow  @relation(...)
  @@index([workflowId])
}
```

### ✅ Acceptance Criteria Met
- ✅ Activate workflow → webhook URL generated
- ✅ POST to webhook → triggers execution
- ✅ Execution appears in `/executions`
- ✅ Execution steps contain trigger payload
- ✅ Execution count increments per webhook
- ✅ Deactivate → removes subscriptions

### 🚫 Out of Scope (Phase 2)
- OAuth/social triggers, polling triggers, cron triggers
- Execution v2 (branching, parallel execution)
- Retry logic, signature validation, rate limiting

---

## 2026-01-04 — Phase 4: Execution Engine v2 (Branching & Conditions)
### ✨ What's New
Extended the execution engine to support **runtime branching** with conditional logic nodes, enabling workflows that make decisions based on data.

### 🎯 Core Features Implemented
1. **Logic Nodes** (`logic` category)
   - New node category alongside `trigger` and `action`
   - Logic nodes evaluate input and return routing decisions
   - Output format: `{ outcome: "true" | "false" }`
   - No side effects - pure evaluation only

2. **If Condition Node** (`logic.condition`)
   - Compares input value against configured criteria
   - Operators: `equals`, `notEquals`, `greaterThan`, `lessThan`, `contains`
   - Returns `{ outcome: "true" }` or `{ outcome: "false" }`
   - Example: Check if number > 50, if email contains "urgent"

3. **Conditional Edges**
   - Extended edge schema with optional `condition` field
   - Edge format: `{ from: "node1", to: "node2", condition: "true" }`
   - Edges without conditions always follow (backward compatible)
   - Logic node edges match outcome to condition

4. **Runtime Traversal Execution**
   - **v1 (deprecated)**: Static topological sort, all nodes execute
   - **v2 (current)**: Runtime graph traversal, selective execution
   - Start at trigger node → execute → evaluate edges → choose next → repeat
   - Only one path executes per run (no parallelism yet)
   - Terminates when no next node found

5. **Enhanced Execution Logging**
   - Added `nodeType` field to execution steps
   - New status: `"skipped"` for nodes not executed due to branching
   - Steps only created for executed nodes
   - Final result = last executed node output

### 📊 Branching Data Flow
```
Trigger Node (entry point)
  ↓ execute → store output
  ↓
Logic Node (if.condition)
  ↓ execute → { outcome: "true" | "false" }
  ↓
Evaluate outgoing edges:
  ├─ edge with condition: "true" → follow if outcome is "true"
  ├─ edge with condition: "false" → follow if outcome is "false"
  └─ edge with no condition → always follow (non-logic nodes)
  ↓
Action Node (conditional execution)
  ↓ execute only if path was taken
  ↓ terminate (no more edges)
```

### 🔧 Technical Architecture

#### Graph Resolution (v2)
```typescript
interface ExecutionGraph {
  nodeMap: Map<string, WorkflowNode>;
  adjacency: Map<string, Array<{ targetId: string; condition?: string }>>;
  triggerNodeId: string;
}
```

#### Edge Evaluation Logic
- **Logic nodes**: Match `output.outcome` with `edge.condition`
- **Non-logic nodes**: Follow first unconditional edge
- **No match**: Execution terminates (not an error)

#### Execution Loop
```
currentNodeId = triggerNodeId
while currentNodeId:
  node = graph.nodeMap.get(currentNodeId)
  output = executeNode(node)
  nextNodeId = getNextNode(currentNodeId, output, nodeCategory, graph)
  currentNodeId = nextNodeId
```

### 📝 Schema Changes
**WorkflowEdge** (extended, backward compatible):
```typescript
{
  from: string;
  to: string;
  condition?: string; // Optional: "true", "false", or custom
}
```

**ExecutionStep** (extended):
```typescript
{
  nodeId: string;
  nodeType: string; // NEW: for better debugging
  status: "running" | "success" | "skipped" | "failed"; // Added "skipped"
  startedAt: string;
  finishedAt?: string;
  output?: unknown;
  error?: string;
}
```

**AutomationNode** (extended):
```typescript
{
  type: string;
  category: "trigger" | "action" | "logic"; // Added "logic"
  // ... rest unchanged
}
```

### ✅ Test Results
```
Test Case 1: Input = 75 (> 50)
  ✅ trigger → if (outcome: "true") → slack
  ✅ 3 steps executed, all success

Test Case 2: Input = 30 (< 50)
  ✅ trigger → if (outcome: "false") → terminate
  ✅ 2 steps executed, slack not executed

Test Case 3: Linear workflow (no branching)
  ✅ trigger → action → terminate
  ✅ Backward compatible with v1 workflows
```

### 🧠 Design Principles
- **Deterministic**: Same input always produces same execution path
- **Defensive**: Validates logic node output format strictly
- **Logged**: Every executed node creates a step record
- **Backward Compatible**: v1 linear workflows execute unchanged
- **Minimal Surface**: No breaking changes to existing APIs

### 🔐 Execution Guarantees
- ✅ **No cycles**: Runtime tracking prevents infinite loops
- ✅ **No parallelism**: Sequential execution (one node at a time)
- ✅ **No retries**: Failures terminate execution immediately
- ✅ **Full audit**: Every executed node logged with input/output
- ✅ **Clean termination**: No-next-node is valid completion

### 🚫 Out of Scope (Phase 4)
- Parallel execution (multiple branches at once)
- Nested conditions (if inside if)
- Loop nodes (repeat until condition)
- Switch nodes (multi-way branching)
- Async logic evaluation
- Dynamic edge creation

### 📦 New Nodes Available
- `logic.condition` - If/else branching based on comparison
- `test.trigger.passthrough` - Testing trigger that returns input unchanged

### 🛠️ Migration Guide
**For existing workflows**: No changes required. v1 workflows execute unchanged.

**For new branching workflows**:
1. Add logic node to workflow definition
2. Configure comparison operator and value
3. Add conditional edges: `{ from: "logicNode", to: "targetNode", condition: "true" }`
4. Ensure target nodes handle logic node's outcome

**Example branching workflow**:
```json
{
  "nodes": [
    { "id": "trigger1", "type": "test.trigger.passthrough", "config": {} },
    { "id": "if1", "type": "logic.condition", "config": { "operator": "greaterThan", "value": 50 } },
    { "id": "action1", "type": "slack.action.sendMessage", "config": { "channel": "#alerts", "message": "High value!" } }
  ],
  "edges": [
    { "from": "trigger1", "to": "if1" },
    { "from": "if1", "to": "action1", "condition": "true" }
  ]
}
```

### 🔍 Debugging Branching Workflows
- Check execution steps in `/executions/[id]`
- Look for logic node output: `{ outcome: "true" | "false" }`
- Verify edge conditions match logic node outcomes
- Missing nodes in steps = path not taken (expected behavior)

---

## 2026-01-04 — Phase 4b: Engine v2 Hardening & Finalization
### 🎯 What Changed
Hardened Execution Engine v2 with comprehensive safety checks, defensive error handling, and extensive test coverage.

### 🛡️ Safety Features Added

**1. Cycle Detection**
- Tracks executed node IDs during traversal
- Throws explicit error if node executed twice
- Includes execution path in error message
- Maximum iteration limit as safety fallback

**2. Ambiguous Routing Detection**
- **Logic nodes**: Throws error if multiple edges match same outcome
- **Non-logic nodes**: Throws error if multiple unconditional edges exist
- Prevents non-deterministic execution paths

**3. Missing Node Validation**
- Validates all edge endpoints exist in node map
- Validates node exists in registry before execution
- Lists available nodes/types in error messages

**4. Malformed Output Detection**
- Logic nodes must output `{ outcome: string }`
- Throws clear error if output format is invalid
- Validates against node's output schema

**5. Conditional Edge Warnings**
- Warns if non-logic node has only conditional edges
- Prevents misconfiguration (conditional edges only for logic nodes)
- Terminates cleanly rather than following wrong path

**6. Graph Validation**
- Validates workflow has at least one node
- Validates exactly one trigger node (entry point)
- Validates all nodes have required id and type fields

### 📊 Error Messages Enhanced

**Before (v2.0):**
```
Error: Node not found in graph: xyz
```

**After (v2.1 - Hardened):**
```
Error: Cycle detected: Node action1 has already been executed.
Execution path: trigger → action1 → action2 → action1
```

**Before:**
```
Error: Logic node output must have "outcome" field
```

**After:**
```
Error: Logic node if_1 output must have "outcome" field.
Got: {"result": true, "value": 100}
```

**Before:**
```
Error: No trigger node found
```

**After:**
```
Error: No trigger node found. Every workflow must have exactly one node
with no incoming edges (the entry point). All nodes have incoming edges.
```

### 🧪 Comprehensive Test Coverage

Created `test-engine-v2-hardened.ts` with 7 test cases:

1. ✅ **Linear workflow** - v1 backward compatibility
2. ✅ **True branch** - Conditional edge with true outcome
3. ✅ **False branch** - Conditional edge with false outcome
4. ✅ **Unmatched condition** - Clean termination when no edge matches
5. ✅ **Ambiguous routing** - Multiple matching edges (fails correctly)
6. ✅ **Cycle detection** - Detects and fails on cycles
7. ✅ **Multiple unconditional edges** - Detects ambiguous non-logic routing

**All 7 tests passing:** ✅✅✅✅✅✅✅

### 🔐 Determinism Guarantees

Engine v2 (hardened) guarantees:
- ✅ **Single execution path** - Exactly one path executes per run
- ✅ **No ambiguity** - Throws error if routing is unclear
- ✅ **No infinite loops** - Cycle detection + iteration limit
- ✅ **Clean termination** - Unmatched conditions terminate gracefully
- ✅ **Full audit trail** - Every executed node logged with I/O
- ✅ **Fail-fast** - Errors detected early with clear messages

### 📝 Code Quality Improvements

**Safety Checks Added:**
```typescript
// Maximum iteration safety limit
const MAX_ITERATIONS = definition.nodes.length * 2;

// Explicit cycle detection
if (executedNodeIds.has(currentNodeId)) {
  throw new Error(`Cycle detected: Node ${currentNodeId}...`);
}

// Ambiguous routing detection
if (matchingEdges.length > 1) {
  throw new Error(`Ambiguous routing detected...`);
}

// Missing node validation
if (!nodeMap.has(edge.from)) {
  throw new Error(`Invalid edge: source node "${edge.from}" does not exist...`);
}
```

**Defensive Error Messages:**
- Include execution context (node IDs, paths, available options)
- Suggest fixes when possible
- Distinguish between user error and system error

### 🚀 Production Readiness

Engine v2 is now:
- ✅ **Battle-tested** - 7 comprehensive tests covering edge cases
- ✅ **Fail-safe** - Detects and reports all ambiguities
- ✅ **Debuggable** - Clear error messages with full context
- ✅ **Backward compatible** - v1 workflows unchanged
- ✅ **Performance safe** - Iteration limits prevent runaway execution

### 🎓 Key Learnings

**1. Fail Loudly, Not Silently**
- Old: `break` on cycle → silent termination
- New: `throw` with execution path → clear failure

**2. Ambiguity is a Bug**
- Multiple matching edges = non-deterministic
- Must fail at runtime, not produce random results

**3. Context in Errors Matters**
- List available nodes when node not found
- Show execution path when cycle detected
- Include outcome value when routing fails

**4. Safety Limits Prevent Disasters**
- Maximum iterations as backstop
- Prevents infinite loops in misconfigured workflows

### 📚 Testing Commands

```bash
# Run original v2 tests (3 scenarios)
npx tsx scripts/test-engine-v2.ts

# Run hardened test suite (7 edge cases)
npx tsx scripts/test-engine-v2-hardened.ts
```

Both test suites must pass for release.

---
## 2026-01-04 — Phase 5: Execution Control Layer
### ✨ What's New
Added a **thin safety and control layer** on top of the execution engine to provide production-grade reliability without modifying core engine logic.

### 🎯 Core Features Implemented

**1. Execution Cancellation**
- New API endpoint: `POST /api/executions/:id/cancel`
- New execution statuses: `CANCEL_REQUESTED`, `ABORTED`
- Engine guard checks status before each node
- Graceful shutdown: remaining nodes marked as `skipped`
- Abort metadata: `abortedAt`, `abortedBy`, `abortReason`

**2. FAILED vs ABORTED Distinction**
- **FAILED**: Node threw error (bugs, network issues)
  - Has `error` field with stack trace
  - Indicates system problem
- **ABORTED**: User/policy intervention (cancel, rate limit)
  - NO `error` field
  - Has abort metadata instead
  - Clean termination, not an error

**3. Idempotency (Duplicate Prevention)**
- Prevents duplicate executions from:
  - Webhook retries
  - Network duplication
  - Manual replays
- Strategy:
  - Compute `idempotencyKey` from workflow context + trigger data
  - Check if execution exists with same key
  - If exists, return existing execution ID
  - If not, create new execution
- Key format: `workflowId:nodeId:webhookPath:eventId|hash`
- Uses explicit `eventId` if provided, otherwise hashes payload

**4. Engine Guard (Minimal Change)**
- Checks execution status before each node
- If status ≠ `RUNNING`, abort immediately
- Works with linear and branching workflows
- Clean termination (no exceptions)
- Minimal performance impact (one DB query per node)

### 📊 Data Flow

**Cancellation Flow:**
```
User clicks Cancel
  ↓ POST /api/executions/:id/cancel
  ↓ Update status → CANCEL_REQUESTED
  ↓ Store abort metadata
  ↓ Return 200 immediately
  ↓
Engine Guard (before next node)
  ↓ Fetch execution status
  ↓ Status ≠ RUNNING
  ↓ Mark remaining nodes as skipped
  ↓ Update execution → ABORTED
  ↓ Return execution ID (clean)
```

**Idempotency Flow:**
```
Webhook Event (retry)
  ↓ Extract eventId or hash payload
  ↓ Compute idempotencyKey
  ↓ Check if execution exists
  ├─ EXISTS → return existing execution ID
  └─ NOT EXISTS → create new execution with key
```

### 🔧 Technical Details

**Schema Changes:**
```prisma
enum ExecutionStatus {
  PENDING
  RUNNING
  SUCCESS
  FAILED
  CANCEL_REQUESTED  // NEW
  ABORTED           // NEW
}

model Execution {
  // ... existing fields
  idempotencyKey  String?   @unique    // NEW
  abortedAt       DateTime?            // NEW
  abortedBy       String?              // NEW
  abortReason     String?              // NEW
  @@index([idempotencyKey])
}
```

**New API Endpoint:**
```http
POST /api/executions/:id/cancel
Content-Type: application/json

{
  "reason": "User requested cancellation"
}
```

**Response:**
```json
{
  "success": true,
  "executionId": "clx123...",
  "status": "CANCEL_REQUESTED",
  "abortedAt": "2026-01-04T10:30:00.000Z",
  "abortedBy": "user_123",
  "abortReason": "User requested cancellation"
}
```

**Idempotent Execution:**
```typescript
import { runWorkflowIdempotent } from "@/lib/execution/idempotency";

const result = await runWorkflowIdempotent({
  workflowId: "workflow_123",
  userId: "user_456",
  triggerInput: webhookPayload,
  idempotency: {
    nodeId: "trigger-1",
    webhookPath: "stripe-payment",
    eventId: webhookPayload.id,  // Use external event ID
  },
});

if (result.isDuplicate) {
  console.log(`Duplicate: ${result.executionId}`);
}
```

### ✅ Acceptance Criteria Met

**Cancellation:**
- ✅ User can cancel RUNNING execution
- ✅ Execution stops immediately after cancel
- ✅ Status → ABORTED (not FAILED)
- ✅ Remaining nodes marked as skipped
- ✅ Abort metadata stored

**Idempotency:**
- ✅ Duplicate webhook doesn't create second execution
- ✅ Returns existing execution ID
- ✅ Works with eventId and payload hash
- ✅ Different payloads create new executions

**FAILED vs ABORTED:**
- ✅ Node error → FAILED with error field
- ✅ User cancel → ABORTED with abort metadata
- ✅ Statuses are distinct and observable

### 🧪 Testing

```bash
# Run control layer test suite
npx tsx scripts/test-execution-control.ts
```

**Tests verify:**
1. ✅ Execution stops after cancel
2. ✅ ABORTED status set correctly
3. ✅ Duplicate webhooks prevented
4. ✅ FAILED vs ABORTED distinction
5. ✅ Idempotency with event ID and payload hash

## 🔒 Execution Locking & Concurrency Safety (Phase 4)

**Problem:** Multiple concurrent webhooks for the same workflow trigger multiple simultaneous executions, leading to race conditions and unpredictable behavior.

**Solution:** Database-enforced locking ensures only one execution per workflow can be RUNNING at a time.

### ✨ Key Features

- **Atomic Lock Acquisition** - Database unique constraint prevents concurrent locks
- **Automatic Release** - Locks freed immediately when execution reaches terminal state (SUCCESS, FAILED, ABORTED)
- **Stale Lock Detection** - Automatically cleans up locks from crashed executions
- **Clear Error Semantics** - `WorkflowLockedError` and `LockAcquisitionFailedError` return 409 Conflict, not 500 errors
- **Zero Engine Changes** - Minimal integration, no core logic modified
- **TTL-Based Cleanup** - 1-hour expiry prevents orphaned locks

### 🧪 Test Coverage

Run concurrency safety tests:

```bash
npx tsx scripts/test-execution-locking.ts
```

**Tests verify:**
1. ✅ Second concurrent request blocked with WorkflowLockedError
2. ✅ Lock released after SUCCESS
3. ✅ Lock released after FAILED
4. ✅ Concurrent webhooks handled correctly (409 Conflict)
5. ✅ Idempotency and locking work together
6. ✅ No orphaned locks after execution completes

### 📚 Documentation

See full documentation: 
- [`docs/EXECUTION_LOCKING.md`](docs/EXECUTION_LOCKING.md) - Concurrency safety details
- [`docs/EXECUTION_CONTROL_LAYER.md`](docs/EXECUTION_CONTROL_LAYER.md) - Cancellation and idempotency

### 🚫 Out of Scope (Phase 5)

Intentionally NOT added:
- ❌ Retries (future feature)
- ❌ Queues (future feature)
- ❌ Parallel execution (future feature)
- ❌ Workflow schema changes
- ❌ UI changes (backend-only)

This is **pure control logic**, not orchestration or UX.

### 🎯 Production Benefits

✅ **Safe** - No runaway executions  
✅ **Idempotent** - Webhook retries handled correctly  
✅ **Observable** - FAILED vs ABORTED distinction  
✅ **Minimal** - No engine rewrite  
✅ **Defensive** - Handles edge cases  
✅ **Scalable** - Ready for retries, queues later

---