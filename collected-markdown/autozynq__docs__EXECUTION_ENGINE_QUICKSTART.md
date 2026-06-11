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

... (truncated for brevity in collected copy)
