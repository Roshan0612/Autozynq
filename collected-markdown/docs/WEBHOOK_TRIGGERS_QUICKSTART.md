# Webhook Triggers - Quick Reference

## 🚀 Quick Start

### 1. Activate Workflow

```typescript
import { activateWorkflow } from "@/lib/workflow/activation";

const result = await activateWorkflow(workflowId, userId);

// Get webhook URL
const webhookUrl = result.triggers[0].webhookUrl;
console.log(webhookUrl);
// → http://localhost:3000/api/webhooks/cm...
```

### 2. Send Webhook Event

```bash
# Using curl
curl -X POST http://localhost:3000/api/webhooks/cmjxvmov60003x8jt5qwvhs7h \
  -H "Content-Type: application/json" \
  -d '{"event": "order.created", "orderId": "12345"}'

# Using PowerShell
Invoke-RestMethod `
  -Uri "http://localhost:3000/api/webhooks/cmjxvmov60003x8jt5qwvhs7h" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"event":"order.created","orderId":"12345"}'
```

### 3. Check Trigger Status

```bash
curl http://localhost:3000/api/webhooks/cmjxvmov60003x8jt5qwvhs7h
```

## 📡 API Endpoints

### Activate Workflow
```
POST /api/workflows/:id/activate
Authorization: Bearer {token}

Response:
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
  ]
}
```

### Deactivate Workflow
```
DELETE /api/workflows/:id/activate
Authorization: Bearer {token}
```

### Receive Webhook
```
POST /api/webhooks/:triggerId
Content-Type: application/json

{ ...payload... }

Response:
{
  "success": true,
  "executionId": "cm...",
  "triggerId": "cm...",
  "message": "Workflow execution started"
}
```

### Get Trigger Info
```
GET /api/webhooks/:triggerId

Response:
{
  "triggerId": "cm...",
  "workflowId": "cm...",
  "type": "WEBHOOK",
  "isActive": true,
  "isValid": true
}
```

## 🔄 Common Patterns

### Activate and Get Webhook URL

```typescript
const { triggers } = await activateWorkflow(workflowId);
const webhookUrl = triggers[0].webhookUrl;

// Share webhook URL with external service
console.log(`Configure webhook: ${webhookUrl}`);
```

### Check if Workflow is Active

```typescript
const workflow = await prisma.workflow.findUnique({
  where: { id: workflowId },
  include: { triggers: true },
});

const isActive = workflow.status === "ACTIVE";
const activeTriggers = workflow.triggers.filter(t => t.isActive);
```

### Get All Workflow Triggers

```typescript
import { getWorkflowTriggers } from "@/lib/triggers";

const triggers = await getWorkflowTriggers(workflowId);

triggers.forEach(trigger => {
  console.log(`${trigger.id}: ${trigger.isActive ? 'Active' : 'Inactive'}`);
});
```

### Validate Trigger Before Use

```typescript
import { getTriggerById, validateTriggerActive } from "@/lib/triggers";

const trigger = await getTriggerById(triggerId);

if (!trigger) {
  throw new Error("Trigger not found");
}

await validateTriggerActive(trigger); // Throws if inactive
```

## 🧪 Testing Locally

### 1. Run Test Script

```bash
npx tsx scripts/test-webhook-triggers.ts
```

This creates a test workflow and prints webhook URL.

### 2. Start Dev Server

```bash
npm run dev
```

### 3. Send Test Webhook

Use the webhook URL from step 1:

```bash
curl -X POST http://localhost:3000/api/webhooks/[triggerId] \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

### 4. Check Execution

```bash
npx prisma studio
```

Navigate to `Execution` table to see results.

## ⚠️ Common Errors

### Trigger Not Found (404)
```json
{ "error": "Trigger not found" }
```
**Solution**: Verify trigger ID is correct and trigger exists in database.

### Trigger Not Active (403)
```json
{
  "error": "Trigger is not active",
  "details": { "triggerId": "cm..." }
}
```
**Solution**: Activate workflow via POST `/api/workflows/:id/activate`

### Workflow Not Active (403)
```json
{
  "error": "Workflow is not active",
  "details": { "workflowId": "cm...", "status": "DRAFT" }
}
```
**Solution**: Workflow must be ACTIVE. Check workflow status and activate if needed.

## 🔐 Security Notes

### Current Status
- ✅ Trigger IDs are non-guessable UUIDs (cuid)
- ✅ Validation checks before execution
- ⚠️ No webhook signature verification (Phase 3)
- ⚠️ No rate limiting (Phase 3)

### Production Checklist
- [ ] Implement webhook signature verification
- [ ] Add rate limiting per trigger
- [ ] Set up monitoring/alerting for trigger failures
- [ ] Configure webhook timeout policies
- [ ] Add trigger event logging

## 📊 Trigger Lifecycle

```
DRAFT Workflow
     │
     │ POST /api/workflows/:id/activate
     ▼
ACTIVE Workflow
     │
     ├─► Triggers Registered (isActive = true)
     │   └─► Webhook URL available
     │
     │ Webhook events → Execute workflow
     │
     │ DELETE /api/workflows/:id/activate
     ▼
PAUSED Workflow
     │
     └─► Triggers Deactivated (isActive = false)
         └─► Webhook events return 403
```

## 📚 Related Files

- **Trigger Service**: [lib/triggers/service.ts](../lib/triggers/service.ts)
- **Webhook Handler**: [app/api/webhooks/[triggerId]/route.ts](../app/api/webhooks/[triggerId]/route.ts)
- **Activation Logic**: [lib/workflow/activation.ts](../lib/workflow/activation.ts)
- **Full Documentation**: [PHASE_2_WEBHOOK_TRIGGERS.md](PHASE_2_WEBHOOK_TRIGGERS.md)
- **Test Script**: [scripts/test-webhook-triggers.ts](../scripts/test-webhook-triggers.ts)

## 🎉 Next Steps

With webhook triggers working, you can now:

1. ✅ **Connect External Services**: Give webhook URLs to external services (Stripe, GitHub, etc.)
2. ✅ **Build UI**: Create workflow activation toggle in frontend
3. ✅ **Add Monitoring**: Track webhook events and execution success rates
4. 🔜 **Phase 3**: Add scheduled triggers (cron jobs)
5. 🔜 **Phase 4**: Add webhook signature verification
6. 🔜 **Phase 5**: Add rate limiting and abuse prevention

---

**Your automation platform is now event-driven!** 🚀
