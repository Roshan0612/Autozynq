# Execution Engine v1 - Quick Start Guide

## 🚀 Basic Usage

### Execute a Workflow

```typescript
import { runWorkflow } from "@/lib/execution";

const executionId = await runWorkflow({
  workflowId: "cm...",
  userId: "cm...",
  triggerInput: { /* optional */ },
});
```

### Fetch Execution Details

```typescript
import { prisma } from "@/lib/prisma";

const execution = await prisma.execution.findUnique({
  where: { id: executionId },
  include: { workflow: true },
});

console.log("Status:", execution.status);
console.log("Result:", execution.result);
console.log("Steps:", execution.steps);
```

## 📡 API Endpoint

### Manual Execution

```bash
POST /api/workflows/{id}/execute
Content-Type: application/json
Authorization: Bearer {token}

{
  "triggerInput": {
    "subject": "Test Email"
  }
}
```

**Response:**
```json
{
  "executionId": "cm...",
  "status": "SUCCESS",
  "startedAt": "2026-01-02T16:20:27.447Z",
  "finishedAt": "2026-01-02T16:20:29.174Z"
}
```

### Get Execution History

```bash
GET /api/workflows/{id}/execute?limit=10&status=SUCCESS
Authorization: Bearer {token}
```

**Response:**
```json
{
  "executions": [
    {
      "id": "cm...",
      "status": "SUCCESS",
      "startedAt": "...",
      "finishedAt": "...",
      "result": { ... },
      "error": null
    }
  ]
}
```

## 🧪 Testing

Run the test suite:

```bash
npx tsx scripts/test-execution-engine.ts
```

## 📊 Execution Model

### Status Flow

```
PENDING → RUNNING → SUCCESS
                  ↘ FAILED
```

### Execution Record

```typescript
{
  id: "cm...",
  workflowId: "cm...",
  userId: "cm...",
  status: "SUCCESS" | "FAILED" | "RUNNING" | "PENDING",
  startedAt: Date,
  finishedAt: Date | null,
  result: any,        // Final output
  error: {            // Only if FAILED
    message: string,
    nodeId?: string,
    stepIndex?: number,
    stack?: string
  },
  steps: [            // Step-by-step log
    {
      nodeId: "trigger_1",
      status: "success",
      startedAt: "...",
      finishedAt: "...",
      output: { ... }
    }
  ]
}
```

## 🎯 Common Patterns

### Webhook Integration (Future)

```typescript
export async function POST(req: Request) {
  const payload = await req.json();
  
  await runWorkflow({
    workflowId: webhook.workflowId,
    triggerInput: payload,
  });
  
  return Response.json({ received: true });
}
```

### Scheduled Execution (Future)

```typescript
// Cron job
async function scheduledTask() {
  const activeSchedules = await prisma.schedule.findMany({
    where: { nextRun: { lte: new Date() } },
  });
  
  for (const schedule of activeSchedules) {
    await runWorkflow({
      workflowId: schedule.workflowId,
    });
  }
}
```

### UI "Test Run" Button

```typescript
async function handleTestRun() {
  try {
    const res = await fetch(`/api/workflows/${workflowId}/execute`, {
      method: "POST",
    });
    
    const { executionId } = await res.json();
    
    // Poll for results or redirect to execution page
    router.push(`/workflows/${workflowId}/executions/${executionId}`);
  } catch (error) {
    toast.error("Execution failed");
  }
}
```

## ⚠️ Error Handling

### Workflow Not Found

```typescript
try {
  await runWorkflow({ workflowId: "invalid" });
} catch (error) {
  // Error: "Workflow not found: invalid"
}
```

### Workflow Not Active

```typescript
try {
  await runWorkflow({ workflowId: draftWorkflow.id });
} catch (error) {
  // Error: "Workflow is not active: cm... (status: DRAFT)"
}
```

### Node Execution Failure

```typescript
// Execution status = FAILED
// execution.error = {
//   message: "Node action_1 (slack.action.sendMessage) failed at step 1: API error",
//   nodeId: "action_1",
//   stepIndex: 1
// }
```

## 🔍 Debugging

### Enable Console Logs

Node implementations already log to console:

```typescript
[Gmail Trigger] Simulated new email: { ... }
[Slack Action] Received input from previous node: { ... }
[Slack Action] Message sent to #general: New email received!
```

### Inspect Execution Steps

```typescript
const execution = await prisma.execution.findUnique({
  where: { id: executionId },
});

const steps = execution.steps as any[];
steps.forEach((step, idx) => {
  console.log(`Step ${idx + 1}: ${step.nodeId}`);
  console.log(`  Status: ${step.status}`);
  console.log(`  Output:`, step.output);
  if (step.error) console.log(`  Error:`, step.error);
});
```

## 📚 Related Files

- **Engine**: [lib/execution/engine.ts](../lib/execution/engine.ts)
- **Documentation**: [lib/execution/README.md](../lib/execution/README.md)
- **API Route**: [app/api/workflows/[id]/execute/route.ts](../app/api/workflows/[id]/execute/route.ts)
- **Test Script**: [scripts/test-execution-engine.ts](../scripts/test-execution-engine.ts)

## 🎉 Success!

You now have a fully functional execution engine. Next steps:

1. ✅ Implement webhooks → Call `runWorkflow()`
2. ✅ Add "Run" button in UI → Use `/api/workflows/[id]/execute`
3. ✅ Build schedulers → Call `runWorkflow()` on cron

The core automation platform is **ready to ship**! 🚀
