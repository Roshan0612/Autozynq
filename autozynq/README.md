# Autozynq

A Next.js app with Prisma + NextAuth (GitHub/Google), Tailwind v3, and shadcn-style components.

## Overview
- Foundation: Next.js 15.5.9 (App Router), Prisma v5, NextAuth v4
- Database: Neon PostgreSQL
- UI: Tailwind v3, Radix UI wrappers, lucide-react icons
- Theme: next-themes with global ThemeProvider

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment:
   - .env / .env.local: DATABASE_URL, NEXTAUTH_URL, NEXTAUTH_SECRET, GitHub/Google OAuth keys
3. Generate Prisma client:
   ```bash
   npx prisma generate
   ```
4. Run dev server:
   ```bash
   npm run dev
   ```

## Auth
- Providers: GitHub + Google
- Persistence: Database session strategy via Prisma Adapter
- Prisma models include User.emailVerified and VerificationToken

## UI
- Components: Button, Tooltip, Dropdown Menu wrappers
- Navbar with centered links; Sidebar with tooltips; ModeToggle at bottom

## Known Issues & Resolutions
- Prisma v7 adapter runtime: Downgraded to Prisma v5 and standard client
- Tailwind v4 PostCSS error: Moved to Tailwind v3; fixed globals.css
- NextAuth account linking: Enabled, added missing models & DB sessions
- Route layout error: Added valid default export for (main)/layout

## Recent Changes
This section is auto-generated from docs/CHANGELOG.md by scripts/post-commit.js.

# Changelog

This file tracks notable changes, issues, and resolutions. The README is auto-generated from this changelog.

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
## 2026-01-04 — Phase 2: Webhook Trigger System
### ✨ What's New
Converted Autozynq from a **workflow runner** into **real automation software** by implementing external event triggers.

### 🎯 Core Features Implemented
1. **TriggerSubscription Model**: New Prisma model for decoupled trigger event subscriptions
   - Unique `webhookPath` for each trigger
   - Tracks `executionCount` and `lastPayload` for debugging
   - Enables trigger history and analytics

2. **Webhook Endpoint** (`POST /api/webhooks/:webhookPath`)
   - Receives HTTP events from external systems
   - No authentication required (webhooks are public)
   - Validates payload is JSON object
   - Starts workflow execution via `runWorkflow()`

3. **Trigger Registration on Activation**
   - When workflow is activated, trigger node is detected
   - Unique `webhookPath` is generated
   - Stored in `TriggerSubscription` table
   - Deactivation removes all subscriptions

4. **Trigger Service Layer** (`/lib/triggers/subscriptions.ts`)
   - `createTriggerSubscription()` - Register webhook trigger
   - `getTriggerSubscriptionByPath()` - Webhook event lookup
   - `updateSubscriptionAfterExecution()` - Track payload & count
   - `getWorkflowSubscriptions()` - Trigger debugging UI

5. **Workflow Activation Layer** (`/lib/workflow/activation.ts`)
   - `activateWorkflow()` - Creates trigger subscription, returns webhook URL
   - `deactivateWorkflow()` - Deletes subscriptions, pauses workflow
   - Clean error handling with `WorkflowActivationError`

### 📊 Data Flow
```
External Event (HTTP)
  ↓ POST /api/webhooks/:webhookPath
  ↓ Lookup TriggerSubscription
  ↓ Verify workflow is ACTIVE
  ↓ Call runWorkflow(workflowId, userId, triggerInput: payload)
  ↓ Execution created with trigger data
  ↓ Steps contain webhook payload in context
  ↓ Execution count & lastPayload updated
  ↓ 200 OK response with execution ID
```

### 🔧 Technical Details
- **Payload Handling**: Webhook payload passed unchanged to execution engine
- **Error Safety**: All errors caught, execution record stores error details
- **Idempotency**: Webhook accepts same payload multiple times (creates separate executions)
- **Debugging**: UI pages display triggers, webhook URLs, payload history

### 📝 Schema Changes
```prisma
model TriggerSubscription {
  id            String    @id @default(cuid())
  workflowId    String
  nodeId        String
  triggerType   String    // "webhook"
  webhookPath   String    @unique
  lastPayload   Json?
  executionCount Int      @default(0)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  workflow      Workflow  @relation(...)
  @@index([workflowId])
}
```

### ✅ Acceptance Criteria Met
- ✅ Activate workflow → webhook URL generated
- ✅ POST to webhook → triggers execution
- ✅ Execution appears in `/executions`
- ✅ Execution steps contain trigger payload
- ✅ Execution count increments per webhook
- ✅ Deactivate → removes subscriptions

### 🚫 Out of Scope (Phase 2)
- OAuth/social triggers, polling triggers, cron triggers
- Execution v2 (branching, parallel execution)
- Retry logic, signature validation, rate limiting