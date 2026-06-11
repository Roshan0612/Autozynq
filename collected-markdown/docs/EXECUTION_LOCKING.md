# Execution Locking & Concurrency Safety Layer

## Overview

The **Execution Locking & Concurrency Safety Layer** prevents concurrent execution of the same workflow through atomic database-enforced locking. This ensures deterministic behavior and prevents race conditions, duplicate side effects, and inconsistent state.

**Key Principle**: Only one execution of a workflow can be in the `RUNNING` state at any time.

## Problem Solved

### Before Locking
- Multiple `POST /api/webhooks/:id` requests could start concurrent executions
- Same workflow could run in parallel, causing:
  - Duplicate side effects (send email twice, etc.)
  - Race conditions on shared resources
  - Inconsistent execution state
  - Hard-to-debug concurrency bugs

### After Locking
- Concurrent execution attempts are blocked cleanly
- Lock is automatically released on terminal states
- Clear error semantics distinguish lock conflicts from system errors
- Works seamlessly with idempotency

## Architecture

### ExecutionLock Model

```prisma
model ExecutionLock {
  id          String    @id @default(cuid())
  workflowId  String    @unique  // Enforces 1 lock per workflow
  executionId String             // Which execution holds the lock
  lockedAt    DateTime  @default(now())
  expiresAt   DateTime  @default(dbgenerated("NOW() + interval '1 hour'"))
}
```

**Constraints**:
- `workflowId` is unique → ensures only 1 lock per workflow
- Database enforces atomicity → no race conditions
- TTL (`expiresAt`) enables recovery from crashed executions

### Lock Lifecycle

```
runWorkflow() called
  ↓
Create execution record (PENDING → RUNNING)
  ↓
Attempt atomic lock acquisition
  ├─ Lock acquired → Execute workflow
  │   ├─ SUCCESS → Release lock, mark execution SUCCESS
  │   ├─ FAILED → Release lock, mark execution FAILED
  │   └─ ABORTED → Release lock, mark execution ABORTED
  │
  └─ Lock denied → Delete execution record, throw error
      (another workflow is RUNNING)
```

## Error Types

### WorkflowLockedError

Thrown when lock cannot be acquired because workflow is already executing.

```typescript
{
  name: "WorkflowLockedError"
  workflowId: "workflow_123"
  existingExecutionId: "exec_abc"
  message: "Workflow ... is currently locked by execution ..."
}
```

**Webhook Response** (409 Conflict):
```json
{
  "success": false,
  "error": "Workflow currently executing",
  "details": "Only one execution can run at a time. Currently executing: exec_abc",
  "existingExecutionId": "exec_abc"
}
```

**Action**: Caller should retry later or use the existing execution ID for polling.

### LockAcquisitionFailedError

Thrown when constraint violation indicates concurrent lock acquisition.

```typescript
{
  name: "LockAcquisitionFailedError"
  workflowId: "workflow_123"
  reason: "Concurrent lock acquisition detected..."
}
```

**Webhook Response** (409 Conflict):
```json
{
  "success": false,
  "error": "Concurrent execution attempted",
  "details": "Another concurrent request acquired the execution lock"
}
```

**Action**: Another request succeeded in acquiring the lock. Caller should retry with backoff.

### StaleExecutionLockError

Internal error when lock exists but execution is not RUNNING.

Automatically cleaned up and lock retried.

## API Integration

### Webhook Handler Flow

```typescript
POST /api/webhooks/:triggerId
  ↓
Parse payload & lookup trigger
  ↓
Call runWorkflowIdempotent()
  ├─ Check idempotency key
  ├─ Create execution record
  ├─ Attempt lock acquisition  ← NEW
  │  ├─ WorkflowLockedError → Return 409 Conflict
  │  └─ Acquired → Execute
  ├─ Release lock on completion ← NEW
  └─ Return 200 OK

Return status codes:
  200 → Execution started (or duplicate)
  409 → Workflow locked (concurrent execution)
  500 → System error
```

## Usage Examples

### Direct API Usage

```typescript
import { 
  runWorkflow, 
  WorkflowLockedError 
} from "@/lib/execution";

try {
  const executionId = await runWorkflow({
    workflowId: "workflow_123",
    userId: "user_456",
    triggerInput: { ... },
  });
  
  console.log(`Execution started: ${executionId}`);
} catch (error) {
  if (error instanceof WorkflowLockedError) {
    // Workflow is currently executing
    console.log(`Workflow locked by: ${error.existingExecutionId}`);
    console.log(`Retry after execution completes`);
  } else {
    throw error;
  }
}
```

### Webhook Integration

```typescript
// Webhook handler automatically handles locking
// Returns 409 Conflict if workflow is locked

const response = await fetch("POST /api/webhooks/stripe-payment", {
  method: "POST",
  body: JSON.stringify(stripeEvent),
});

if (response.status === 409) {
  // Workflow is locked
  const data = await response.json();
  console.log(`Workflow locked by: ${data.existingExecutionId}`);
} else if (response.status === 200) {
  // Execution started or duplicate
  const data = await response.json();
  console.log(`Execution: ${data.executionId}`);
}
```

### Lock Status Checking

```typescript
import { getExecutionLockStatus } from "@/lib/execution/lock";

const status = await getExecutionLockStatus("workflow_123");

if (status.isLocked) {
  console.log(`Locked by execution: ${status.executionId}`);
  console.log(`Locked since: ${status.lockedSince}`);
  console.log(`Expires at: ${status.expiresAt}`);
} else {
  console.log("Workflow is free to execute");
}
```

## Behavior Matrix

| Scenario | Lock Status | Action | Result |
|----------|-------------|--------|--------|
| Execution starts | No lock | Acquire | SUCCESS: Execute |
| Concurrent webhook | Lock exists, RUNNING | Reject | 409 Conflict |
| Retry after crash | Lock exists, not RUNNING | Clean & retry | SUCCESS: Execute |
| Lock expired (TTL) | Lock.expiresAt < now | Clean & retry | SUCCESS: Execute |
| Execution finishes | Has lock | Release | Lock removed |

## Performance Characteristics

### Lock Acquisition
- **Cost**: 1 additional DB query (unique constraint check + insert)
- **Atomicity**: Database-enforced via unique constraint
- **Latency**: <5ms typical (single DB round-trip)

### Lock Release
- **Cost**: 1 additional DB query (delete by workflowId)
- **Atomicity**: Database-enforced
- **Latency**: <5ms typical

### No Deadlocks Possible
- Single lock per workflow
- No lock ordering (only acquiring, not holding multiple)
- TTL prevents indefinite holds

## Testing

Run comprehensive concurrency tests:

```bash
npx tsx scripts/test-execution-locking.ts
```

**Tests verify**:
1. ✅ Lock acquisition blocks concurrent executions
2. ✅ Lock release on SUCCESS
3. ✅ Lock release on FAILED
4. ✅ Lock release on ABORTED
5. ✅ Concurrent webhooks handled safely
6. ✅ No orphaned locks remain

## Migration

To apply the schema changes:

```bash
npx prisma migrate dev --name add_execution_locking
```

This will:
- Create `ExecutionLock` table
- Create unique index on `workflowId`
- Create index on `expiresAt` for cleanup queries

## Configuration

### Lock TTL

Default: 1 hour (3600 seconds)

To change:
```prisma
expiresAt   DateTime  @default(dbgenerated("NOW() + interval '30 minutes'"))
```

### Cleanup Job (Recommended)

Add periodic cleanup of expired locks:

```typescript
// cron job or background task
import { cleanupExpiredLocks } from "@/lib/execution/lock";

setInterval(async () => {
  const count = await cleanupExpiredLocks();
  if (count > 0) {
    console.log(`Cleaned up ${count} expired locks`);
  }
}, 5 * 60 * 1000); // Every 5 minutes
```

## Design Principles

### Database-Enforced Consistency
- Unique constraint on `workflowId` prevents race conditions
- No application-level locking needed
- Works across multiple server instances

### Defensive Error Handling
- Stale locks automatically detected and cleaned
- Orphaned locks impossible (TTL + terminal state cleanup)
- All errors have clear semantics

### Minimal Engine Changes
- Lock acquisition after execution creation
- Lock release before execution returns
- Engine logic completely untouched

### Backward Compatible
- Existing workflows continue to work
- Lock errors are new but don't break existing code
- Idempotency + locking work together transparently

## Troubleshooting

### Workflow appears to be stuck

Check lock status:
```typescript
const status = await getExecutionLockStatus(workflowId);
if (status.isStale) {
  // Lock is stale, waiting for cleanup
  // Will be cleaned automatically when TTL expires
}
```

### Stale locks not cleaning up

Check if TTL is set correctly. Run manual cleanup:
```typescript
import { cleanupExpiredLocks } from "@/lib/execution/lock";
await cleanupExpiredLocks();
```

### Force unlock (emergency only)

```typescript
import { forceReleaseLock } from "@/lib/execution/lock";
await forceReleaseLock(workflowId);
// Only use if execution is confirmed dead
```

## Future Enhancements

Current design supports:
- ✅ Sequential execution (one at a time)
- ✅ Concurrent execution prevention
- ✅ Automatic TTL cleanup

Future possibilities (without code changes):
- Queued execution with Priority field
- Per-node locking for parallelism
- Distributed locking across clusters

## FAQ

**Q: What if lock TTL expires while execution is running?**  
A: Lock expires after 1 hour. Normal executions complete in seconds/minutes. If execution runs >1 hour and crashes, lock will auto-clean after TTL.

**Q: Can locks deadlock?**  
A: No. Single lock per workflow, no lock ordering, always released on completion.

**Q: What happens to executing workflows during deployment?**  
A: Locks are properly released on graceful shutdown. If server crashes, TTL ensures cleanup after 1 hour.

**Q: Can idempotency key and locking conflict?**  
A: No, they work together. Idempotency checks first (same eventId = same execution). Locking prevents concurrent starts.

**Q: What if I need to run two workflows concurrently?**  
A: Different workflows have separate locks. Only same workflow is serialized. Multiple workflows run in parallel.

**Q: How do retries work with locking?**  
A: Retries happen AFTER execution finishes (FAILED or ABORTED). Lock is released, allowing retry to start.

**Q: Can I have multiple executions queued?**  
A: Not with this layer. It's synchronous locking only. Queue system would be a future enhancement.
