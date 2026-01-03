# Phase 2: Webhook Trigger Infrastructure

**External event-driven workflow execution for Autozynq automation platform**

---

## 🎯 Overview

Phase 2 adds webhook trigger capabilities that allow external HTTP events to start workflow executions. This infrastructure bridges external services with the Execution Engine, enabling true automation.

## 🏗️ Architecture

### System Components

```
External Service
     │
     │ HTTP POST
     ▼
┌─────────────────┐
│ Webhook Handler │ ◄── /api/webhooks/:triggerId
│  (API Route)    │
└────────┬────────┘
         │
         │ 1. Lookup trigger
         │ 2. Validate active
         ▼
┌─────────────────┐
│ Trigger Service │ ◄── lib/triggers/service.ts
│  (Bridge Layer) │
└────────┬────────┘
         │
         │ 3. Prepare input
         │ 4. Call runWorkflow()
         ▼
┌─────────────────┐
│ Execution Engine│ ◄── Runs workflow
└─────────────────┘
```

### Data Flow

1. **Webhook received** → Parse payload
2. **Lookup trigger** → Get workflow + node ID
3. **Validate** → Check trigger & workflow active
4. **Execute** → Call `runWorkflow()` with payload
5. **Respond** → Return execution ID immediately

## 📦 Core Components

### 1. WorkflowTrigger Model

Database table storing trigger registrations:

```prisma
model WorkflowTrigger {
  id         String      @id @default(cuid())
  workflowId String
  nodeId     String      // Which trigger node in workflow
  type       TriggerType // WEBHOOK | SCHEDULE | EMAIL
  isActive   Boolean     @default(true)
  config     Json?       // Trigger-specific configuration
  createdAt  DateTime    @default(now())
  updatedAt  DateTime    @updatedAt
  
  workflow   Workflow    @relation(...)
}
```

### 2. Trigger Service (`lib/triggers/service.ts`)

Core business logic for trigger lifecycle:

- **`registerWorkflowTriggers()`** - Create trigger entries on activation
- **`deactivateWorkflowTriggers()`** - Disable triggers on pause
- **`getTriggerById()`** - Lookup trigger metadata
- **`validateTriggerActive()`** - Ensure trigger is ready

### 3. Webhook API Endpoint (`app/api/webhooks/[triggerId]/route.ts`)

Receives external events and bridges to execution:

```typescript
POST /api/webhooks/:triggerId
```

**Request:**
```json
{
  "subject": "New Order",
  "orderId": "12345",
  "customer": "john@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "executionId": "cm...",
  "triggerId": "cm...",
  "message": "Workflow execution started",
  "executionTime": "234ms"
}
```

### 4. Workflow Activation (`lib/workflow/activation.ts`)

Manages workflow lifecycle with automatic trigger registration:

- **`activateWorkflow()`** - Validates + registers triggers + sets ACTIVE
- **`deactivateWorkflow()`** - Disables triggers + sets PAUSED
- **`toggleWorkflowStatus()`** - Switch between ACTIVE/PAUSED

## 🔄 Complete Lifecycle

### Workflow Activation Flow

```typescript
// 1. Activate workflow
const result = await activateWorkflow(workflowId);

// 2. Triggers automatically registered
result.triggers.forEach(trigger => {
  console.log(trigger.webhookUrl);
  // → http://localhost:3000/api/webhooks/cm...
});

// 3. Workflow now accepts webhook events
```

### Webhook Execution Flow

```typescript
// External service sends webhook
POST /api/webhooks/cmjxvmov60003x8jt5qwvhs7h
{
  "event": "order.created",
  "data": { ... }
}

// ↓ Handler processes event

// 1. Lookup trigger → Get workflow ID + node ID
// 2. Validate active → Check workflow ACTIVE
// 3. Execute workflow → runWorkflow(workflowId, payload)
// 4. Return immediately → { executionId: "cm..." }
```

## 📚 Usage Examples

### Activate Workflow with Triggers

```typescript
import { activateWorkflow } from "@/lib/workflow/activation";

const result = await activateWorkflow(workflowId, userId);

console.log("Webhook URLs:");
result.triggers.forEach(trigger => {
  if (trigger.webhookUrl) {
    console.log(`  ${trigger.triggerId}: ${trigger.webhookUrl}`);
  }
});
```

### Send Webhook Event

```bash
# Using curl
curl -X POST http://localhost:3000/api/webhooks/cmjxvmov60003x8jt5qwvhs7h \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "12345",
    "customer": "john@example.com",
    "amount": 99.99
  }'

# Using PowerShell
Invoke-RestMethod `
  -Uri "http://localhost:3000/api/webhooks/cmjxvmov60003x8jt5qwvhs7h" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"orderId":"12345","customer":"john@example.com"}'
```

### Check Trigger Status

```bash
# GET endpoint returns trigger info
curl http://localhost:3000/api/webhooks/cmjxvmov60003x8jt5qwvhs7h

# Response:
{
  "triggerId": "cm...",
  "workflowId": "cm...",
  "type": "WEBHOOK",
  "isActive": true,
  "isValid": true
}
```

### Deactivate Workflow

```typescript
import { deactivateWorkflow } from "@/lib/workflow/activation";

await deactivateWorkflow(workflowId, userId);
// Triggers are now inactive; webhooks will return 403
```

## 🔐 Security & Validation

### Trigger Validation

Before executing, the system validates:

1. **Trigger exists** - `getTriggerById()`
2. **Trigger is active** - `isActive === true`
3. **Workflow exists** - Database lookup
4. **Workflow is ACTIVE** - `status === "ACTIVE"`

All checks must pass or webhook returns 403/404.

### Error Responses

```typescript
// Trigger not found
{ "error": "Trigger not found" } // 404

// Trigger inactive
{
  "error": "Trigger is not active",
  "details": { "triggerId": "cm..." }
} // 403

// Workflow not active
{
  "error": "Workflow is not active",
  "details": {
    "workflowId": "cm...",
    "status": "DRAFT"
  }
} // 403

// Execution failed
{
  "success": false,
  "error": "Failed to process webhook",
  "message": "..."
} // 500
```

## 🧪 Testing

Run the comprehensive test suite:

```bash
npx tsx scripts/test-webhook-triggers.ts
```

This tests:
- ✅ Workflow activation with trigger registration
- ✅ Webhook URL generation
- ✅ Trigger deactivation on pause
- ✅ Trigger reactivation
- ✅ End-to-end trigger lifecycle

### Manual Testing

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Run test script to create workflow:**
   ```bash
   npx tsx scripts/test-webhook-triggers.ts
   ```

3. **Copy webhook URL from output**

4. **Send test webhook:**
   ```bash
   curl -X POST <webhook-url> \
     -H "Content-Type: application/json" \
     -d '{"test": "data"}'
   ```

5. **Check execution in database:**
   ```bash
   npx prisma studio
   ```

## 🔌 API Endpoints

### Workflow Activation

**Activate:**
```
POST /api/workflows/:id/activate
Authorization: Bearer {token}
```

Response:
```json
{
  "success": true,
  "workflowId": "cm...",
  "status": "ACTIVE",
  "triggers": [
    {
      "triggerId": "cm...",
      "webhookUrl": "http://localhost:3000/api/webhooks/cm...",
      "status": "active"
    }
  ],
  "message": "Workflow activated successfully with 1 trigger(s)"
}
```

**Deactivate:**
```
DELETE /api/workflows/:id/activate
Authorization: Bearer {token}
```

### Webhook Trigger

**Execute:**
```
POST /api/webhooks/:triggerId
Content-Type: application/json

{ ...webhook payload... }
```

**Get Info:**
```
GET /api/webhooks/:triggerId
```

## 🎨 Design Principles

### 1. Separation of Concerns

- **Webhook handler** - Only bridges events → execution
- **Trigger service** - Manages trigger lifecycle
- **Execution engine** - Handles workflow execution
- **No business logic in API routes**

### 2. Extensibility

System designed for future trigger types:

```typescript
enum TriggerType {
  WEBHOOK,   // ✅ Implemented
  SCHEDULE,  // 🔜 Coming soon (cron jobs)
  EMAIL,     // 🔜 Coming soon (email triggers)
}
```

### 3. Production-Ready Structure

- ✅ Proper error handling
- ✅ Input validation
- ✅ Comprehensive logging
- ✅ Clean separation of layers
- ✅ Extensible architecture

## 📊 Database Schema

### Migration: `20260103054011_add_workflow_triggers`

```sql
CREATE TYPE "TriggerType" AS ENUM ('WEBHOOK', 'SCHEDULE', 'EMAIL');

CREATE TABLE "WorkflowTrigger" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "type" "TriggerType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    
    CONSTRAINT "WorkflowTrigger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkflowTrigger_workflowId_nodeId_key" 
  ON "WorkflowTrigger"("workflowId", "nodeId");

CREATE INDEX "WorkflowTrigger_workflowId_idx" 
  ON "WorkflowTrigger"("workflowId");

CREATE INDEX "WorkflowTrigger_type_isActive_idx" 
  ON "WorkflowTrigger"("type", "isActive");
```

## 🔮 Future Enhancements

### Phase 3: Advanced Triggers

1. **Scheduled Triggers** - Cron-based execution
2. **Email Triggers** - Inbound email processing
3. **App Events** - Internal application events
4. **Webhook Signatures** - Verify webhook authenticity
5. **Rate Limiting** - Prevent abuse
6. **Trigger History** - Log all incoming events
7. **Conditional Triggers** - Filter events before execution

## 📁 Files Created/Modified

### Created
- ✅ `lib/triggers/types.ts` - Type definitions
- ✅ `lib/triggers/service.ts` - Trigger business logic
- ✅ `lib/triggers/index.ts` - Public API exports
- ✅ `lib/workflow/activation.ts` - Activation logic
- ✅ `app/api/webhooks/[triggerId]/route.ts` - Webhook handler
- ✅ `app/api/workflows/[id]/activate/route.ts` - Activation API
- ✅ `scripts/test-webhook-triggers.ts` - Test suite
- ✅ `prisma/migrations/20260103054011_add_workflow_triggers/` - Migration

### Modified
- ✅ `prisma/schema.prisma` - Added WorkflowTrigger model + TriggerType enum

## ✅ Success Criteria

All Phase 2 requirements met:

✅ Webhook API endpoint receives external events  
✅ Triggers map to workflows via configuration  
✅ Execution starts via `runWorkflow()`  
✅ WorkflowTrigger model stores subscriptions  
✅ Triggers registered on activation  
✅ Triggers deactivated on pause  
✅ Clean separation of concerns  
✅ No workflow logic in API routes  
✅ Production-ready structure  
✅ Comprehensive testing  
✅ Clear documentation  

---

**Built for Autozynq** - Production-ready webhook trigger infrastructure  
**Phase 2 Complete** - External events now drive workflow automation! 🎉
