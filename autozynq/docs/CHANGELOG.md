# Changelog

This file tracks notable changes, issues, and resolutions. The README is auto-generated from this changelog.

## 2026-01-03 — Phase 2: Webhook Trigger Infrastructure
- **Implemented Webhook Trigger System**: External event-driven workflow execution
  - Created `WorkflowTrigger` model with trigger registration and lifecycle management
  - Implemented trigger service layer (`lib/triggers/service.ts`)
  - Built webhook API endpoint (`/api/webhooks/[triggerId]`) for external events
  - Added workflow activation logic with automatic trigger registration
  - Trigger types enum: WEBHOOK, SCHEDULE, EMAIL (extensible)
- **Key Features**:
  - Automatic trigger registration on workflow activation
  - Public webhook URLs generated for each trigger node
  - Trigger validation (active status, workflow status)
  - Clean separation: webhook handler → trigger service → execution engine
  - GET endpoint for trigger info/debugging
- **API Endpoints**:
  - POST `/api/workflows/[id]/activate` - Activate workflow & register triggers
  - DELETE `/api/workflows/[id]/activate` - Deactivate workflow & disable triggers
  - POST `/api/webhooks/[triggerId]` - Receive webhook events
  - GET `/api/webhooks/[triggerId]` - Get trigger information
- **Testing**: Comprehensive test script for full trigger lifecycle
- **Documentation**: Complete Phase 2 guide with examples and architecture
- **Migration**: Applied `20260103054011_add_workflow_triggers` migration

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
- **Migration**: Applied `20260102154452_execution_engine_v1` migration

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
