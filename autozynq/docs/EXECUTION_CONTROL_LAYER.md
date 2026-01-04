# Execution Control Layer

## Overview

The **Execution Control Layer** is a thin safety and control system built on top of Autozynq's execution engine. It provides execution safety, cancellation, and idempotency without modifying the core engine logic.

This is **NOT** a rewrite of the engine. It's a defensive control layer that ensures production-grade reliability.

## Features

### 1. Execution Cancellation

Users can cancel running executions gracefully. The engine detects the cancellation request and aborts cleanly.

**Key Concepts:**
- `CANCEL_REQUESTED`: User/system has requested cancellation
- `ABORTED`: Execution was stopped by user/policy (not an error)
- `FAILED`: Execution failed due to node error (distinct from abort)

**Flow:**
1. User calls `POST /api/executions/:id/cancel`
2. Execution status → `CANCEL_REQUESTED`
3. Engine guard detects status change before next node
4. Engine stops execution and marks as `ABORTED`
5. Remaining nodes marked as `skipped`

### 2. Idempotency

Prevents duplicate executions from webhook retries, network issues, or manual replays.

**Strategy:**
- Compute idempotency key from:
  - `workflowId`
  - Trigger `nodeId`
  - `webhookPath`
  - `eventId` (if provided) OR payload hash
- Before creating execution, check if key exists
- If exists, return existing execution ID
- If not, create new execution with key

**Benefits:**
- Safe webhook retries
- Network resilience
- Prevents double-charging, double-sending, etc.

### 3. Engine Guard

The engine checks execution status before executing each node. If status is not `RUNNING`, it aborts immediately.

**Implementation:**
- Minimal change to execution loop
- Re-fetches status from database before each node
- Works with linear and branching workflows
- Clean termination (no exceptions)

## API

### Cancel Execution

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
  "message": "Execution marked for cancellation. The engine will abort gracefully.",
  "abortedAt": "2026-01-04T10:30:00.000Z",
  "abortedBy": "user_123",
  "abortReason": "User requested cancellation"
}
```

**Requirements:**
- User must own the workflow
- Execution must be `RUNNING` or `PENDING`
- Returns 400 if execution is already finished

## Execution Statuses

| Status | Meaning | Final? |
|--------|---------|--------|
| `PENDING` | Created, not started | No |
| `RUNNING` | Currently executing | No |
| `SUCCESS` | Completed successfully | Yes |
| `FAILED` | Node threw error | Yes |
| `CANCEL_REQUESTED` | Cancellation requested | No |
| `ABORTED` | Cancelled by user/policy | Yes |

### FAILED vs ABORTED

**Critical distinction:**

- **FAILED**: System or node error (bugs, network issues, invalid config)
  - Has `error` field with stack trace
  - Indicates something went wrong
  - Should trigger alerts/monitoring

- **ABORTED**: Human or policy intervention (user cancel, rate limits, safety)
  - NO `error` field
  - Has `abortedAt`, `abortedBy`, `abortReason`
  - Clean termination, not an error

## Database Schema

### Execution Model

```prisma
model Execution {
  id              String          @id @default(cuid())
  workflowId      String
  userId          String?
  status          ExecutionStatus @default(PENDING)
  startedAt       DateTime        @default(now())
  finishedAt      DateTime?
  result          Json?
  error           Json?           // Only set for FAILED
  steps           Json?
  
  // Idempotency
  idempotencyKey  String?         @unique
  
  // Abort metadata
  abortedAt       DateTime?
  abortedBy       String?         // User ID
  abortReason     String?
  
  workflow Workflow @relation(...)
  
  @@index([idempotencyKey])
}

enum ExecutionStatus {
  PENDING
  RUNNING
  SUCCESS
  FAILED
  CANCEL_REQUESTED
  ABORTED
}
```

## Usage Examples

### Webhook with Idempotency

```typescript
import { runWorkflowIdempotent } from "@/lib/execution/idempotency";

// Webhook receives event
const webhookPayload = {
  id: "evt_stripe_123",  // Event ID from Stripe
  type: "payment.success",
  data: { amount: 1000 }
};

// Run with idempotency
const result = await runWorkflowIdempotent({
  workflowId: "workflow_123",
  userId: "user_456",
  triggerInput: webhookPayload,
  idempotency: {
    nodeId: "trigger-1",
    webhookPath: "stripe-payment",
    eventId: webhookPayload.id,  // Use Stripe event ID
  },
});

if (result.isDuplicate) {
  console.log(`Duplicate event, existing execution: ${result.executionId}`);
} else {
  console.log(`New execution created: ${result.executionId}`);
}
```

### Cancel Execution

```typescript
// User clicks "Cancel" button in UI
const response = await fetch(`/api/executions/${executionId}/cancel`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    reason: "User cancelled from dashboard"
  }),
});

const result = await response.json();
// { success: true, status: "CANCEL_REQUESTED", ... }

// Engine will detect this and abort gracefully
```

## Implementation Details

### Engine Guard

Located in `lib/execution/engine.ts`, before each node execution:

```typescript
while (currentNodeId) {
  // Check for cancellation
  const currentExecution = await prisma.execution.findUnique({
    where: { id: executionId },
    select: { status: true },
  });

  if (currentExecution.status !== "RUNNING") {
    // Mark remaining nodes as skipped
    // Update execution to ABORTED
    // Return cleanly (don't throw)
    return executionId;
  }

  // Continue with node execution...
}
```

### Idempotency Key Computation

Located in `lib/execution/idempotency.ts`:

```typescript
// Format: workflowId:nodeId:webhookPath:eventId|hash
function computeIdempotencyKey(params) {
  const parts = [workflowId, nodeId];
  
  if (webhookPath) parts.push(webhookPath);
  
  if (eventId) {
    parts.push(eventId);  // Prefer explicit event ID
  } else {
    parts.push(hashPayload(payload));  // Fall back to payload hash
  }
  
  return parts.join(":");
}
```

## Testing

Run the test suite:

```bash
npx tsx scripts/test-execution-control.ts
```

**Tests verify:**
1. ✅ Execution stops after cancel request
2. ✅ ABORTED status is set correctly
3. ✅ Duplicate webhooks don't create new executions
4. ✅ FAILED vs ABORTED are distinct
5. ✅ Idempotency works with event ID and payload hash

## Migration

To apply the schema changes:

```bash
npx prisma migrate dev --name add_execution_control_layer
```

This will:
- Add `CANCEL_REQUESTED` and `ABORTED` statuses
- Add `idempotencyKey`, `abortedAt`, `abortedBy`, `abortReason` fields
- Create index on `idempotencyKey`

## Design Constraints

The following were **intentionally NOT added**:

❌ Retries (future feature)  
❌ Queues (future feature)  
❌ Parallel execution (future feature)  
❌ Workflow schema changes  
❌ UI changes (control layer is backend-only)

This is **pure control logic**, not UX or orchestration.

## Benefits

✅ **Production-safe**: No more runaway executions  
✅ **Idempotent**: Safe webhook retries  
✅ **Observable**: FAILED vs ABORTED distinction  
✅ **Minimal**: No engine rewrite  
✅ **Defensive**: Handles all edge cases  
✅ **Scalable**: Ready for retries, queues later

## Next Steps

Future enhancements that can build on this layer:

1. **Retry Logic**: Use FAILED status to trigger auto-retries
2. **Queue System**: Buffer executions when rate-limited
3. **Parallel Execution**: Run multiple branches concurrently
4. **Scheduled Cancellation**: Auto-cancel after timeout
5. **Execution Priority**: Queue management with priorities

The control layer makes all of these possible without changing the engine.

## FAQ

**Q: Can I cancel a PENDING execution?**  
A: Yes, cancellation works for both PENDING and RUNNING executions.

**Q: What if I cancel after execution finishes?**  
A: The API returns 400. You can only cancel PENDING/RUNNING executions.

**Q: Does idempotency work across different workflows?**  
A: No, the key includes `workflowId`, so each workflow has separate idempotency.

**Q: What if two webhooks arrive simultaneously?**  
A: The database unique constraint on `idempotencyKey` prevents duplicates. One will succeed, the other gets existing execution ID.

**Q: Can I manually set an idempotency key?**  
A: Yes, pass it to `runWorkflow({ ..., idempotencyKey: "custom-key" })`.

**Q: Does the engine guard slow down execution?**  
A: Minimal impact - one DB query per node. For most workflows, this is negligible.

## Support

For issues or questions:
- Check test suite for examples
- Review this documentation
- Check engine code comments
- File an issue with execution ID and logs
