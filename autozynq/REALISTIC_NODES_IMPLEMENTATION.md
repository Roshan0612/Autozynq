# Realistic Node Implementation (Make.com-Style Automation)

## Overview

This implementation adds **realistic, production-grade node execution** to Autozynq, transforming the automation platform from basic webhooks to a Make.com/Zapier-style system with:

- ✅ OAuth connection management
- ✅ Dynamic output field discovery  
- ✅ Template-based field mapping ({{steps.nodeId.field}})
- ✅ Real API integration (Google Forms API + Gmail API)
- ✅ Connection-aware node execution
- ✅ Template resolution in node configs

## What Changed

### 1. Connection System (Database Layer)

**File:** `prisma/schema.prisma`

Added `Connection` model:
```prisma
model Connection {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  provider  String   // "google", "gmail", "slack", etc.
  
  // OAuth tokens
  accessToken   String   @db.Text
  refreshToken  String?  @db.Text
  expiresAt     DateTime?
  
  // Flexible metadata (provider-specific)
  metadata  Json?
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@unique([userId, provider])
  @@index([userId, provider])
}
```

**Key Features:**
- Unique constraint per user + provider (one Gmail connection per user)
- Text fields for large tokens
- Optional expiresAt for token refresh tracking
- Flexible metadata JSON for provider-specific data

### 2. Connection Service Layer

**File:** `lib/connections/service.ts`

Full CRUD operations for OAuth connections:

```typescript
// Create connection with token storage
createConnection(userId, provider, accessToken, refreshToken?, expiresAt?, metadata?)

// Retrieve connection for node execution
getConnection(connectionId)
getUserConnection(userId, provider)
listUserConnections(userId)

// Update tokens (for refresh flow)
updateConnection(connectionId, updates)

// Delete connection
deleteConnection(connectionId)

// Validation helpers
isConnectionExpired(connection)
validateConnection(connectionId)
```

### 3. Upgraded AutomationNode Interface

**File:** `lib/nodes/base.ts`

Enhanced node definition with connection & introspection support:

```typescript
interface OutputField {
  key: string                    // Machine name
  label: string                  // Display name
  type: "string"|"number"|"boolean"|"object"|"array"
  description?: string
}

interface AutomationNode {
  // Existing fields...
  type: string
  category: "trigger"|"action"|"logic"
  configSchema: ZodSchema
  outputSchema: ZodSchema
  
  // NEW: Connection & introspection
  requiresConnection?: boolean    // Flag: needs OAuth
  provider?: "google"|"gmail"|... // OAuth provider
  outputFields: OutputField[]     // Static output schema
  
  // NEW: Dynamic field discovery
  getDynamicOutputFields?(
    config: unknown, 
    userId: string
  ): Promise<OutputField[]>
  
  // Existing run method
  async run(ctx: NodeContext): Promise<unknown>
}

interface NodeContext {
  input: unknown
  config: unknown
  // NEW: Pass outputs from all previous nodes
  previousOutputs?: Record<string, unknown>
  // ... existing fields
}
```

### 4. Template Resolution Engine

**File:** `lib/execution/templateResolver.ts`

Resolves template strings in node configs:

```typescript
// Main function: resolve {{steps.nodeId.field}} in strings
resolveTemplate(template, previousOutputs)
// Input:  "Email: {{steps.trigger1.email}}"
// Output: "Email: john@example.com"

// Recursively resolve templates in objects/arrays
resolveConfigTemplates(config, previousOutputs)

// Validate all refs can be resolved
validateTemplateRefs(template, previousOutputs)

// Extract all {{...}} references
extractTemplateRefs(template)
```

**Features:**
- Supports nested paths: `{{steps.nodeId.user.email}}`
- Array access: `{{steps.nodeId.items.0.name}}`
- Type coercion for non-string values
- Graceful fallback to empty string for missing fields

### 5. Realistic Google Forms Trigger

**File:** `lib/nodes/google_forms/newResponse.trigger.ts`

Upgraded from basic webhook handler to full Google Forms API integration:

```typescript
{
  type: "google_forms.trigger.newResponse",
  requiresConnection: true,
  provider: "google",
  
  configSchema: {
    connectionId: string      // OAuth connection for API access
    formId: string           // Google Form ID
    includeAttachments: boolean
    conditions?: [...]
  },
  
  outputFields: [
    { key: "responseId", label: "Response ID", type: "string" },
    { key: "submittedAt", label: "Submitted At", type: "string" },
    { key: "formTitle", label: "Form Title", type: "string" }
    // + dynamic fields from form questions
  ],
  
  // NEW: Discover form structure dynamically
  async getDynamicOutputFields(config, userId) {
    // 1. Get Google connection (OAuth)
    const connection = await getConnection(config.connectionId)
    
    // 2. Fetch form metadata via Google Forms API
    const formStructure = await getFormStructure(formId, accessToken)
    
    // 3. Generate OutputField for each question
    return formStructure.questions.map(q => ({
      key: q.questionId,
      label: q.title,
      type: q.type === "scale" ? "number" : "string"
    }))
  }
}
```

**Key Changes:**
- Requires Google OAuth connection
- Fetches actual form structure from Google Forms API
- Generates dynamic output fields based on form questions
- Normalizes webhook payload to match form structure

### 6. Realistic Gmail Action

**File:** `lib/nodes/gmail/sendEmail.action.ts`

Upgraded from mock to real Gmail API integration:

```typescript
{
  type: "gmail.action.sendEmail",
  requiresConnection: true,
  provider: "gmail",
  
  configSchema: {
    connectionId: string     // Gmail OAuth connection
    to: string              // Supports {{steps.trigger1.email}}
    cc?: string
    bcc?: string
    subject: string         // Supports {{steps.ai1.subject}}
    bodyHtml: string        // Supports {{steps.ai1.body}}
  },
  
  outputFields: [
    { key: "messageId", label: "Message ID", type: "string" },
    { key: "threadId", label: "Thread ID", type: "string" },
    { key: "status", label: "Status", type: "string" },
    { key: "to", label: "Recipient", type: "string" },
    { key: "subject", label: "Subject", type: "string" }
  ],
  
  async run(ctx: NodeContext) {
    // 1. Get Gmail OAuth connection
    const connection = await getConnection(ctx.config.connectionId)
    
    // 2. Resolve template strings
    const to = resolveTemplate(ctx.config.to, ctx.previousOutputs)
    const subject = resolveTemplate(ctx.config.subject, ctx.previousOutputs)
    const bodyHtml = resolveTemplate(ctx.config.bodyHtml, ctx.previousOutputs)
    
    // 3. Send real email via Gmail API
    const result = await sendGmailMessage(
      connection.accessToken,
      to, subject, bodyHtml
    )
    
    // 4. Return message/thread IDs for downstream nodes
    return result
  }
}
```

**Key Changes:**
- Requires Gmail OAuth connection
- Resolves all template strings before sending
- Uses real Gmail API (with proper MIME formatting)
- Returns messageId + threadId for tracking

### 7. Execution Engine Updates

**File:** `lib/execution/engine.ts`

Enhanced to support template resolution and output tracking:

```typescript
// NEW: Import template resolver
import { resolveConfigTemplates } from "./templateResolver"

// NEW: Track all node outputs
const nodeOutputs = new Map<string, unknown>()

// NEW: Pass previousOutputs to each node
const ctx: NodeContext = {
  input: previousOutput,
  config: node.config,
  // NEW: All previous node outputs
  previousOutputs: Object.fromEntries(nodeOutputs),
  // ... existing fields
}

// NEW: Resolve config templates BEFORE node execution
const resolvedConfig = resolveConfigTemplates(ctx.config, ctx.previousOutputs)
ctx.config = resolvedConfig

// NEW: Store output for next node to reference
nodeOutputs.set(node.id, output)
```

**Key Changes:**
- Imports template resolver
- Tracks outputs from all executed nodes
- Passes previousOutputs to every NodeContext
- Resolves config templates before node execution
- Enables downstream nodes to reference upstream outputs

### 8. Builder UI Updates

**File:** `app/(main)/(pages)/workflows/[id]/builder/WorkflowBuilderClient.tsx`

Updated node config forms with connection selectors and new template syntax:

**Google Forms Trigger:**
```tsx
// NEW: Connection ID field
<input placeholder="Connection ID from OAuth setup" />

// Config shows which fields are available
Form Title, Response ID, Submitted At, + dynamic form questions
```

**Gmail Send Email Action:**
```tsx
// NEW: Connection ID field
<input placeholder="Connection ID from OAuth setup" />

// Updated template syntax
To:      {{steps.trigger1.email}}
Subject: Thank you {{steps.trigger1.name}}!
Body:    <p>{{steps.ai1.body}}</p>

// Help text explains {{steps.nodeId.field}} syntax
```

## How It Works: Complete Example

### Setup

1. **User OAuth Setup** (in Settings page):
   ```
   Google account → OAuth → Get access + refresh tokens
   Gmail account → OAuth → Get access + refresh tokens
   Store in Connection model
   ```

2. **Build Workflow**:
   - Add Google Forms trigger
   - Select connection + form ID
   - Builder fetches form schema → shows available fields
   - Add Gmail action
   - Reference form fields: `{{steps.trigger1.email}}`

3. **Save & Activate**:
   - Validation checks connections exist
   - Workflow moves to ACTIVE status

### Execution Flow

When a Google Form is submitted:

```
1. Webhook received by /api/webhooks/:triggerId
   └─> runWorkflow(workflowId, formData)

2. Execution Engine starts:
   ├─ Initialize: nodeOutputs = {}, previousOutputs = {}
   │
   ├─ Google Forms Trigger executes:
   │  ├─ Get Google connection (from connectionId)
   │  ├─ Fetch form schema via Google Forms API
   │  ├─ Parse webhook payload → normalize to form fields
   │  ├─ Apply conditions (if configured)
   │  └─ Return: { responseId, formTitle, field1, field2, ... }
   │     └─> Store in nodeOutputs["trigger1"]
   │
   ├─ AI Node executes (if configured):
   │  ├─ Use trigger1 output as input
   │  ├─ Generate email body
   │  └─ Return: { subject, body, ... }
   │     └─> Store in nodeOutputs["ai1"]
   │
   └─ Gmail Action executes:
      ├─ Resolve templates in config:
      │  ├─ to: {{steps.trigger1.email}} → "john@example.com"
      │  ├─ subject: {{steps.ai1.subject}} → "Thank you!"
      │  └─ body: {{steps.ai1.body}} → "<p>Your submission received</p>"
      │
      ├─ Get Gmail connection (from connectionId)
      ├─ Build MIME message
      ├─ Send via Gmail API
      └─ Return: { messageId, threadId, status: "sent" }

3. Execution completes:
   └─> Store result in DB
   └─> Release lock
```

## Architecture Benefits

### 1. Realistic Integration
- Uses real OAuth tokens, not API keys
- Calls actual Google/Gmail APIs
- Handles API responses properly

### 2. Dynamic Field Discovery
- Google Forms trigger auto-discovers form questions
- Builder shows available fields as user configures
- No manual field mapping needed

### 3. Flexible Field Mapping
- Template syntax: `{{steps.nodeId.field}}`
- Works in any string field: to, subject, body
- Supports nested paths and arrays

### 4. Type Safety
- Zod schemas for config validation
- OutputField types for field picker
- Template resolution validates references exist

### 5. Extensibility
- New nodes just implement `getDynamicOutputFields()`
- Connection system reusable for any OAuth provider
- Template engine generic for any string field

## Key Decisions

1. **{{steps.nodeId.field}} not {{answers.field}}**
   - More explicit and flexible
   - Scales to multi-node workflows
   - Matches Make.com/Zapier patterns

2. **Connection stored separately, not in node config**
   - Reusable across nodes
   - Easy token refresh
   - Secure OAuth handling

3. **previousOutputs passed via NodeContext**
   - Available to all nodes
   - Enables runtime decisions
   - Optional field for backward compatibility

4. **Template resolution before node.run()**
   - Node receives resolved strings
   - Simpler node implementation
   - Validation at engine layer

## Integration Checklist

Before production use:

- [ ] OAuth setup endpoints implemented (Google + Gmail)
- [ ] Connection selector UI in builder
- [ ] Field picker with autocomplete ({{steps...)
- [ ] Webhook trigger configured for real Google Forms
- [ ] Gmail API rates/quotas understood
- [ ] Token refresh flow for expired connections
- [ ] Error handling for invalid connections
- [ ] Execution audit log for sent emails
- [ ] User consent + privacy considerations
- [ ] Rate limiting for API calls

## Example: Complete Workflow

**Workflow:** "Auto-reply to Google Form submissions with Gmail"

```
┌─────────────────────────────────┐
│ Google Forms – New Response      │
│ ├─ Connection: google_oauth_123 │
│ ├─ Form ID: 1abc...xyz         │
│ └─ Outputs: {email, name, ...} │
└────────────┬────────────────────┘
             │ (form data)
             ▼
┌─────────────────────────────────┐
│ AI – Generate Email             │
│ ├─ Provider: Gemini             │
│ ├─ Prompt: "Write acknowledgement"
│ └─ Outputs: {subject, body}    │
└────────────┬────────────────────┘
             │ (AI-generated email)
             ▼
┌──────────────────────────────────┐
│ Gmail – Send Email               │
│ ├─ Connection: gmail_oauth_456  │
│ ├─ To: {{steps.trigger1.email}} │
│ ├─ Subject: {{steps.ai1.subject}}
│ ├─ Body: {{steps.ai1.body}}    │
│ └─ Outputs: {messageId, status}│
└──────────────────────────────────┘
```

When a form is submitted:
1. Webhook triggers, gets form data
2. Google Forms node outputs: `{email: "user@example.com", name: "John", ...}`
3. AI node reads input, generates subject/body
4. Gmail node resolves: to → "user@example.com", subject → generated, body → generated
5. Real email sent via Gmail API
6. Execution complete ✓

## Files Modified

| File | Change | Impact |
|------|--------|--------|
| `prisma/schema.prisma` | Added Connection model | Database schema |
| `lib/connections/service.ts` | Created CRUD layer | OAuth management |
| `lib/nodes/base.ts` | Enhanced AutomationNode interface | Node definition contract |
| `lib/execution/templateResolver.ts` | Created template engine | Field mapping |
| `lib/nodes/google_forms/newResponse.trigger.ts` | Real Google Forms API | Dynamic form discovery |
| `lib/nodes/gmail/sendEmail.action.ts` | Real Gmail API + templates | Email sending with field mapping |
| `lib/execution/engine.ts` | Track outputs + resolve templates | Core execution flow |
| `app/(main)/(pages)/workflows/[id]/builder/WorkflowBuilderClient.tsx` | Updated node configs | Builder UI |

## Next Steps (Outside Scope)

1. **OAuth Endpoints**: Google/Gmail login flows
2. **Token Refresh**: Auto-refresh expired tokens
3. **Error Handling**: Connection validation, API error recovery
4. **Field Picker UI**: Autocomplete {{steps... in input fields
5. **Execution Audit**: Log all sent emails with timestamp/status
6. **Rate Limiting**: API quota management
7. **Testing**: Integration tests for real APIs

---

**Status:** Complete implementation of realistic node execution framework.
**Ready for:** OAuth setup, field picker UI, execution auditing.
