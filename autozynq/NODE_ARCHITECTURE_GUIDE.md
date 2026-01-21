# 🎯 Visual Node Architecture Guide

## Node System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      AUTOMATION PLATFORM                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              NODE REGISTRY (lib/nodes/registry.ts)       │  │
│  │  Single source of truth - all nodes registered here     │  │
│  └──────────────────────────────────────────────────────────┘  │
│           ▲           ▲           ▲           ▲                │
│           │           │           │           │                │
│  ┌────────┴─┐  ┌──────┴──┐  ┌────┴──────┐  ┌┴─────────┐     │
│  │ Triggers │  │ Actions │  │   Logic   │  │  Utils   │     │
│  └────┬────┘  └──────┬───┘  └────┬──────┘  └┬─────────┘     │
│       │               │            │         │                │
│  ┌────────────┐   ┌────────────┐  │   ┌──────────────┐      │
│  │ • Gmail    │   │ • Gmail    │  │   │ • If/Else    │      │
│  │ • Forms    │   │ • AI       │  │   └──────────────┘      │
│  │ • Webhook  │   │ • WhatsApp │  │                         │
│  │ • Manual   │   │ • Instagram│  │                         │
│  │            │   │ • HTTP     │  │                         │
│  │            │   │ • Slack    │  │                         │
│  └────────────┘   │ • Email    │  │                         │
│                   │ • Log      │  │                         │
│                   └────────────┘  │                         │
│                                                               │
└─────────────────────────────────────────────────────────────────┘
         │                      │                      │
         ▼                      ▼                      ▼
    ┌────────────┐        ┌────────────┐      ┌──────────────┐
    │   BUILDER  │        │  EXECUTION │      │   DEBUG UI   │
    │     UI     │        │   ENGINE   │      │              │
    │ (discovers │        │ (runs them │      │ (shows logs  │
    │  nodes)    │        │  in order) │      │  & outputs)  │
    └────────────┘        └────────────┘      └──────────────┘
```

---

## Node Lifecycle

```
1. NODE CREATION
   ┌──────────────────────┐
   │  Define AutomationNode
   │  - type, category
   │  - configSchema
   │  - outputSchema
   │  - run() function
   └──────────────────────┘
                │
                ▼
2. EXPORT FROM INDEX
   ┌──────────────────────┐
   │  lib/nodes/[service]/
   │  - [action].action.ts
   │  - index.ts
   └──────────────────────┘
                │
                ▼
3. REGISTER IN REGISTRY
   ┌──────────────────────┐
   │  lib/nodes/registry.ts
   │  - Import nodes
   │  - Spread into nodeRegistry
   └──────────────────────┘
                │
                ▼
4. DISCOVER BY UI
   ┌──────────────────────┐
   │  Builder reads registry
   │  - Shows in sidebar
   │  - Displays metadata
   │  - Generates forms
   └──────────────────────┘
                │
                ▼
5. EXECUTE IN ENGINE
   ┌──────────────────────┐
   │  Execution engine
   │  - Get node from registry
   │  - Validate config
   │  - Call run()
   │  - Capture output
   │  - Chain to next node
   └──────────────────────┘
```

---

## Data Flow in Execution

```
┌─────────────────┐
│  TRIGGER FIRES  │
│  (e.g., webhook)│
└────────┬────────┘
         │ payload: {responseId, email, ...}
         ▼
┌──────────────────────────────┐
│  TRIGGER NODE (node 1)       │
│  type: google_forms.trigger  │
│  run() processes payload     │
└────────┬─────────────────────┘
         │ output: {responseId, email, answers}
         ▼
┌──────────────────────────────┐
│  ACTION NODE (node 2)        │
│  type: ai.action.generateText│
│  input: ↑ (previous output)  │
│  config: {userPrompt, ...}   │
│  run() generates text        │
└────────┬─────────────────────┘
         │ output: {text, model, usage}
         ▼
┌──────────────────────────────┐
│  ACTION NODE (node 3)        │
│  type: gmail.action.sendEmail│
│  input: ↑ (previous output)  │
│  config: {to, subject, ...}  │
│  run() sends email           │
└────────┬─────────────────────┘
         │ output: {messageId, status}
         ▼
┌──────────────────────────────┐
│  EXECUTION COMPLETE          │
│  status: SUCCESS             │
│  All outputs logged          │
└──────────────────────────────┘
```

---

## Template Interpolation Flow

```
WORKFLOW CONFIG
┌─────────────────────────────────────────────────────┐
│ Node 3 (Gmail):                                     │
│ {                                                   │
│   "to": "{{email}}",                               │
│   "subject": "Hello {{name}}",                      │
│   "bodyHtml": "{{text}}"                           │
│ }                                                   │
└─────────────────────────────────────────────────────┘

PREVIOUS OUTPUTS (from Node 1 and Node 2)
┌─────────────────────────────────────────────────────┐
│ Node 1 output: {email: "user@example.com", name: ..}│
│ Node 2 output: {text: "Welcome!", model: "gpt-4"} │
└─────────────────────────────────────────────────────┘

INTERPOLATION (at run time)
┌─────────────────────────────────────────────────────┐
│ "{{email}}" → "user@example.com"                    │
│ "{{name}}" → "John Doe"                             │
│ "{{text}}" → "Welcome!"                             │
└─────────────────────────────────────────────────────┘

RESOLVED CONFIG
┌─────────────────────────────────────────────────────┐
│ {                                                   │
│   "to": "user@example.com",                         │
│   "subject": "Hello John Doe",                      │
│   "bodyHtml": "Welcome!"                           │
│ }                                                   │
└─────────────────────────────────────────────────────┘
```

---

## Node Categories & Their Roles

```
TRIGGERS (Entry Points)
═════════════════════════════════════════════════════
  • Can start workflow
  • Run once per event
  • Pass output to first action
  • Examples: Form, Webhook, Manual

  ┌─────────────┐
  │   TRIGGER   │ ─→ output
  └─────────────┘


ACTIONS (Processing)
═════════════════════════════════════════════════════
  • Receive input from previous node
  • Process and transform
  • Pass output to next action
  • Can call external APIs
  • Examples: AI, Email, WhatsApp

  input ─→ ┌─────────┐ ─→ output
           │ ACTION  │
           └─────────┘


LOGIC (Branching)
═════════════════════════════════════════════════════
  • Evaluate conditions
  • Route to different paths
  • Merge execution paths
  • Examples: If/Else

        ┌────────┐
   ─→   │ LOGIC  │   ─→ path 1
        │        │
        │ BRANCH │   ─→ path 2
        └────────┘
```

---

## New Nodes Structure

```
lib/nodes/
├── google_forms/
│   ├── newResponse.trigger.ts  ✅ UPDATED
│   │   ├── configSchema
│   │   ├── outputSchema
│   │   └── run()
│   ├── getForm.action.ts
│   ├── getResponse.action.ts
│   ├── listResponses.action.ts
│   └── index.ts
│
├── ai/
│   ├── generateText.action.ts  ✅ UPDATED
│   │   ├── configSchema (+ outputFormat)
│   │   ├── outputSchema (+ json field)
│   │   └── run() (+ JSON parsing)
│   ├── generateEmail.action.ts
│   └── index.ts
│
├── gmail/
│   ├── sendEmail.action.ts  ✅ UPDATED
│   │   ├── configSchema (spec-compliant)
│   │   ├── outputSchema
│   │   └── run()
│   ├── newEmail.trigger.ts
│   └── index.ts
│
├── whatsapp/  ✅ NEW
│   ├── sendMessage.action.ts
│   │   ├── configSchema
│   │   ├── outputSchema
│   │   └── run()
│   └── index.ts
│
├── instagram/  ✅ NEW
│   ├── createPost.action.ts
│   │   ├── configSchema
│   │   ├── outputSchema
│   │   └── run()
│   └── index.ts
│
├── base.ts  (AutomationNode interface - unchanged)
├── index.ts  (exports - unchanged)
└── registry.ts  ✅ UPDATED
    └── imports all nodes and registers them
```

---

## Config Schema Hierarchy

```
TRIGGER NODE
└── configSchema: z.object({
    formId: z.string(),
    includeAttachments: z.boolean(),
    conditions?: z.array(z.object({
      field: z.string(),
      operator: z.enum([...]),
      value?: z.string()
    }))
  })

ACTION NODE
└── configSchema: z.object({
    provider: z.enum([...]),
    model: z.string(),
    userPrompt: z.string(),
    temperature: z.number(),
    outputFormat?: z.object({
      type: z.literal("json"),
      schema?: z.record(z.string())
    })
  })

OUTPUT SCHEMA
└── outputSchema: z.object({
    text?: z.string(),
    json?: z.record(z.any()),
    model: z.string(),
    usage?: z.object({...})
  })
```

---

## Error Handling Flow

```
NODE EXECUTION
┌─────────────────────┐
│  Validate config    │
└──────┬──────────────┘
       │ Error? ──→ ┌──────────────┐
       │            │ Log error    │
       │            │ Return error │
       │            └──────────────┘
       ├─ No error
       ▼
┌─────────────────────┐
│  Run node.run()     │
└──────┬──────────────┘
       │ Error? ──→ ┌──────────────┐
       │            │ Log error    │
       │            │ Return error │
       │            └──────────────┘
       ├─ No error
       ▼
┌─────────────────────┐
│  Validate output    │
└──────┬──────────────┘
       │ Error? ──→ ┌──────────────┐
       │            │ Log error    │
       │            │ Return error │
       │            └──────────────┘
       ├─ No error
       ▼
┌─────────────────────┐
│  Return output      │
│  Continue to next   │
└─────────────────────┘
```

---

## TypeScript Type Safety

```
CONFIG INPUT
┌─────────────────────────────┐
│ const config = z.infer<     │
│   typeof configSchema       │
│ >                           │
└─────────────────────────────┘

RUNTIME VALIDATION
┌─────────────────────────────┐
│ const cfg =                 │
│   configSchema.parse(       │
│     ctx.config              │
│   ) as Config               │
└─────────────────────────────┘

NODE EXECUTION
┌─────────────────────────────┐
│ async run(ctx: NodeContext) │
│   : Promise<Output>         │
│ {                           │
│   // cfg is fully typed     │
│   // output is validated    │
│ }                           │
└─────────────────────────────┘

OUTPUT VALIDATION
┌─────────────────────────────┐
│ return outputSchema.parse({  │
│   text: generatedText,       │
│   model: config.model,       │
│   usage: usage               │
│ })                           │
└─────────────────────────────┘
```

---

## Integration Points Summary

```
BUILDER UI
  │
  ├─→ Reads registry
  ├─→ Gets displayName, description, configSchema
  ├─→ Generates config forms
  └─→ Shows nodes by category

EXECUTION ENGINE
  │
  ├─→ Gets node from registry
  ├─→ Validates config with configSchema
  ├─→ Calls node.run(ctx)
  ├─→ Validates output with outputSchema
  ├─→ Passes output to next node
  └─→ Logs everything

WEBHOOK INFRASTRUCTURE
  │
  ├─→ Receives HTTP POST
  ├─→ Finds trigger subscription
  ├─→ Calls runWorkflow() with payload
  └─→ Engine executes trigger node with payload

DEBUG UI
  │
  ├─→ Shows execution status
  ├─→ Shows step inputs/outputs
  ├─→ Shows errors and logs
  └─→ Allows replay/debugging
```

---

## Summary: How It All Works Together

```
1. DEFINE NODE
   └─→ File in lib/nodes/[service]/[action].ts
   └─→ Implements AutomationNode interface
   └─→ Pure function, no side effects

2. EXPORT FROM SERVICE
   └─→ File: lib/nodes/[service]/index.ts
   └─→ Object: [service]Nodes

3. REGISTER GLOBALLY
   └─→ File: lib/nodes/registry.ts
   └─→ All nodes available everywhere

4. DISCOVER BY UI
   └─→ Builder reads registry
   └─→ Shows available nodes
   └─→ Generates config forms

5. EXECUTE IN ENGINE
   └─→ Get node type from registry
   └─→ Validate config
   └─→ Call run() function
   └─→ Validate output
   └─→ Pass to next node

6. DEBUG & MONITOR
   └─→ All steps logged
   └─→ Outputs captured
   └─→ Errors visible in Debug UI

✨ END-TO-END WORKFLOW EXECUTION ✨
```

---

## Files Quick Reference

| File | Purpose | Status |
|------|---------|--------|
| `lib/nodes/base.ts` | AutomationNode interface | Unchanged ✅ |
| `lib/nodes/registry.ts` | Central registration | Updated ✅ |
| `lib/nodes/google_forms/newResponse.trigger.ts` | Form trigger | Updated ✅ |
| `lib/nodes/ai/generateText.action.ts` | AI action | Updated ✅ |
| `lib/nodes/gmail/sendEmail.action.ts` | Email action | Updated ✅ |
| `lib/nodes/whatsapp/sendMessage.action.ts` | WhatsApp action | New ✅ |
| `lib/nodes/instagram/createPost.action.ts` | Instagram action | New ✅ |

**Ready for production!** ✨
