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
