# Changelog

This file tracks notable changes, issues, and resolutions. The README is auto-generated from this changelog.

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
