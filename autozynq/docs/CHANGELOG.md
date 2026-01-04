# Changelog

This file tracks notable changes, issues, and resolutions. The README is auto-generated from this changelog.

## 2026-01-03 — Phase 3: Debug UI Refactoring
- **Refactored Debug UI to Use TriggerSubscription Model**: Unified trigger management across UI
  - Migrated triggers list page from legacy `WorkflowTrigger` to `TriggerSubscription` model
  - Created new `/triggers/[id]` detail page with comprehensive webhook info display
  - Added Trigger Payload section to execution detail page
  - Cleaned up old card-based trigger markup, replaced with table-based layout
- **Triggers List Page** (`/triggers`):
  - Shows all webhook trigger subscriptions for user's workflows
  - Columns: Workflow link, Node ID, Trigger Type badge, Webhook Fires count, Creation date, View detail link
  - Supports filtering by workflow status
- **Trigger Detail Page** (`/triggers/[id]`) **[NEW]**:
  - **Summary Card**: Subscription ID, Workflow link, Trigger Node, Trigger Type, Total Executions, Created date
  - **Webhook URL Card**: Full POST URL with copy button, example cURL request instructions
  - **Last Payload Card**: Display latest webhook payload in collapsible JSON viewer
  - **Recent Executions Card**: Latest 10 executions table with status badges, timestamps, duration, view links
- **Execution Detail Page** (`/executions/[id]`):
  - Added "Trigger Payload" section displaying webhook input JSON (when available)
  - Shows raw execution result before Summary section
  - Maintains existing sections: Summary, Error Panel, Step Timeline
- **Workflow Pages**:
  - `/workflows` - Read-only workflow list (no changes needed, uses Workflow model)
  - `/workflows/[id]` - Workflow detail viewer (no changes needed)
  - Both properly linked to debug UI pages
- **Code Quality**:
  - All pages properly handle async params for Next.js 15 compatibility
  - Zero TypeScript compilation errors across all debug pages
  - Proper authentication/authorization checks on all pages
  - User ownership verification for all workflows and executions
- **Migration**: No database changes required; uses existing TriggerSubscription model

## 2026-01-03 — Phase 2: Webhook Trigger Infrastructure
- **Implemented Webhook Trigger System**: External event-driven workflow execution
  - Created `TriggerSubscription` model with webhook path, execution count, last payload tracking
  - Implemented trigger service layer (`lib/triggers/subscriptions.ts`) with full CRUD operations
  - Built webhook API endpoint (`/api/webhooks/[webhookPath]`) for external events
  - Added workflow activation logic with automatic subscription registration
  - Generates unique webhook paths per trigger node
- **Key Features**:
  - Automatic trigger subscription creation on workflow activation
  - Unique webhook URLs with random path component
  - Trigger validation (active workflow status check)
  - Execution count and payload history tracking
  - Clean separation: webhook handler → subscription service → execution engine
  - GET endpoint for trigger subscription info/debugging
- **API Endpoints**:
  - POST `/api/workflows/[id]/activate` - Activate workflow & create subscriptions
  - DELETE `/api/workflows/[id]/activate` - Deactivate workflow & delete subscriptions
  - POST `/api/webhooks/[webhookPath]` - Receive webhook events & start execution
  - GET `/api/webhooks/[webhookPath]` - Get subscription information
- **Testing**: Comprehensive test script (5/5 tests passing) validating full subscription lifecycle
- **Documentation**: Complete Phase 2 guide with architecture and examples
- **Migration**: Applied `20251230161026_workflow_core` migration

## 2026-01-02 — Execution Engine v1
- **Implemented Execution Engine v1**: Linear, deterministic workflow execution
  - Core engine (`lib/execution/engine.ts`) with `runWorkflow()` function
  - Topological sort for DAG resolution (Kahn's algorithm)
  - Sequential node execution with full context passing
  - Progressive execution state tracking with steps logging
  - Error handling with detailed failure information
- **Database Updates**: Extended Execution model with `result`, `error`, `steps`, `userId` fields
- **NodeContext Enhancement**: Added `workflowId`, `userId`, `stepIndex` fields
- **API Integration**: Created `/api/workflows/[id]/execute` endpoint for manual workflow execution
- **Testing**: Comprehensive test script validates end-to-end execution flow
- **Documentation**: Full README in `lib/execution/` with architecture details
- **Migration**: Applied `20251223074007_init` migration

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
