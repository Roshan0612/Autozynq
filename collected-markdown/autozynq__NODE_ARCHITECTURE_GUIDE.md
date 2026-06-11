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
   │  │  - outputSchema
   │  │  - run() function
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
