# Autozynq

A full-stack automation workflow platform built with Next.js, NextAuth, Prisma, and PostgreSQL.

---

## 📅 Day 1 - Foundation & Authentication Setup

### **Phase: Project Initialization**

**Date:** December 22, 2025  
**Goal:** Set up authentication, database connection, and protected dashboard - NO automation logic yet.

---

### ✅ What We Accomplished

1. **Project Setup**
   - Created Next.js 16.1.0 project with App Router
   - Configured TypeScript and ESLint
   - Set up development environment

2. **Environment Configuration**
   - Created `.env.local` for secrets management
   - Configured environment variables:
     - `DATABASE_URL` (Neon PostgreSQL)
     - `NEXTAUTH_SECRET`
     - `NEXTAUTH_URL`
     - `GITHUB_ID` and `GITHUB_SECRET`

3. **Database Layer (Prisma)**
   - Installed Prisma 7.2.0 and @prisma/client
   - Initialized Prisma with PostgreSQL provider
   - Created `prisma/schema.prisma` (no models yet - as planned)
   - Created `prisma.config.ts` for database configuration
   - Successfully generated Prisma Client

4. **Authentication (NextAuth)**
   - Installed next-auth
   - Configured GitHub OAuth provider
   - Created auth route: `/app/api/auth/[...nextauth]/route.ts`
   - Exported `authOptions` for reusability
   - Set up GitHub OAuth App with callback URL

5. **Session Management**
   - Created `AuthProvider` component wrapping `SessionProvider`
   - Modified `app/layout.tsx` to wrap entire app with session context
   - Session available in all client components

6. **Protected Dashboard**
   - Created `/dashboard` route
   - Implemented session-based authentication check
   - Auto-redirect to login if unauthenticated
   - Display user email when authenticated
   - Added logout functionality

---

### 🛠️ Technologies Used

| Technology | Version | Purpose |
|-----------|---------|---------|
| Next.js | 16.1.0 | App Router framework |
| TypeScript | ^5 | Type safety |
| Prisma | 7.2.0 | Database ORM |
| NextAuth | Latest | Authentication |
| PostgreSQL | - | Database (Neon) |
| React | 19.2.3 | UI library |

---

### 📂 Project Structure

```
autozynq/
├── app/
│   ├── api/
│   │   └── auth/
│   │       └── [...nextauth]/
│   │           └── route.ts         # NextAuth configuration
│   ├── components/
│   │   └── AuthProvider.tsx         # Session provider wrapper
│   ├── dashboard/
│   │   └── page.tsx                 # Protected dashboard
│   ├── layout.tsx                   # Root layout with AuthProvider
│   └── page.tsx                     # Home page
├── prisma/
│   └── schema.prisma                # Prisma schema (no models yet)
├── prisma.config.ts                 # Prisma 7 configuration
├── .env.local                       # Environment variables
└── package.json
```

---

### 🔧 Implementation Details

#### 1. **NextAuth Setup**
```typescript
// app/api/auth/[...nextauth]/route.ts
- Used GitHub Provider
- Exported authOptions for reusability
- Configured NEXTAUTH_SECRET for session security
```

#### 2. **Session Provider**
```typescript
// app/components/AuthProvider.tsx
- "use client" directive for client-side rendering
- Wrapped SessionProvider around children
```

#### 3. **Protected Route**
```typescript
// app/dashboard/page.tsx
- Used useSession() hook
- Handled loading, unauthenticated, and authenticated states
- Implemented auto-redirect to /api/auth/signin
```

#### 4. **Prisma Configuration**
```prisma
// prisma/schema.prisma
- PostgreSQL provider
- No models defined (Day 1 scope)
- Client generated successfully
```

---

### 🚧 Issues Faced & Solutions

#### **Issue 1: Prisma 7 Breaking Changes**
- **Problem:** Prisma 7.2.0 initially failed with error about `url` property no longer supported in schema files
- **Root Cause:** Prisma 7 changed configuration approach, requiring `prisma.config.ts`
- **Solution:** 
  - Prisma init automatically created `prisma.config.ts`
  - Updated `schema.prisma` to use `prisma-client-js` generator
  - Installed `dotenv` dependency as required by Prisma config
  - Successfully generated client

#### **Issue 2: Node Module Deletion**
- **Problem:** Initial attempt to delete project folder failed due to locked `.node` files
- **Root Cause:** VS Code or Node process had file locks on native modules
- **Solution:** Used PowerShell recursive deletion with error suppression

#### **Issue 3: Environment Variable Management**
- **Problem:** Need to keep secrets secure while documenting setup
- **Solution:** 
  - Used `.env.local` (already in `.gitignore` via `.env*` pattern)
  - Started with placeholders, filled in during setup
  - Documented pattern without exposing actual secrets in README

---

### ✅ Verification Checklist

- [x] Next.js development server runs successfully
- [x] Build completes without errors
- [x] No TypeScript or ESLint errors
- [x] Database connection configured (Neon PostgreSQL)
- [x] Prisma Client generates successfully
- [x] GitHub OAuth configured and working
- [x] `/api/auth/signin` route accessible
- [x] `/dashboard` protected and redirects when unauthenticated
- [x] User can log in with GitHub
- [x] Session persists across page refreshes
- [x] Logout functionality works

---

### 🎯 What's NOT Included (By Design)

- ❌ Database models (User, Workflow, Run, etc.)
- ❌ Workflow builder UI
- ❌ Execution engine
- ❌ Triggers (webhook, schedule, manual)
- ❌ SSE/WebSocket for real-time updates
- ❌ UI styling or design system
- ❌ Prisma Adapter for NextAuth

**Reason:** Day 1 is foundation only - authentication + database connection

---

### 📝 Environment Variables Required

```env
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
NEXTAUTH_SECRET=generate_random_32_char_string
NEXTAUTH_URL=http://localhost:3000
GITHUB_ID=your_github_oauth_client_id
GITHUB_SECRET=your_github_oauth_client_secret
```

---

### 🚀 Running the Project

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Generate Prisma Client
npx prisma generate
```

Visit [http://localhost:3000](http://localhost:3000)

---

### 🔐 GitHub OAuth Setup

1. Go to: https://github.com/settings/developers
2. Click "New OAuth App"
3. Fill in:
   - **Application name:** Autozynq
   - **Homepage URL:** http://localhost:3000
   - **Authorization callback URL:** http://localhost:3000/api/auth/callback/github
4. Copy Client ID and Client Secret to `.env.local`

---

### 📚 Key Learnings

1. **Prisma 7** has significant config changes - `prisma.config.ts` is now required
2. **NextAuth in App Router** requires separating client components (`AuthProvider`) from server layout
3. **Session management** needs `"use client"` directive for hooks like `useSession()`
4. **Protected routes** in App Router use client-side checks with `useSession()` and `useRouter()`

---

## 🔜 Next Steps (Day 2)

- Design database schema (User, Workflow, WorkflowRun, Step, Log)
- Integrate Prisma Adapter with NextAuth
- Create API routes for workflow CRUD
- Begin workflow builder UI foundation

---

## 📖 Documentation

- [Next.js Docs](https://nextjs.org/docs)
- [NextAuth.js Docs](https://next-auth.js.org/)
- [Prisma Docs](https://www.prisma.io/docs)
- [Neon PostgreSQL](https://neon.tech/docs)
