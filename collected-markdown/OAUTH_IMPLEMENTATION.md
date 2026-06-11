# OAuth Connection Flow Implementation - Complete

## Status
✅ **Complete and Running** - Dev server active on http://localhost:3001

## What Was Implemented

### 1. Google OAuth Flow (Backend)

**[app/api/oauth/google/start/route.ts](app/api/oauth/google/start/route.ts)**
- Validates authenticated user via NextAuth
- Generates Google OAuth URL with:
  - Scopes: `forms.responses.readonly`, `gmail.send`
  - `access_type=offline` for refresh tokens
  - `prompt=consent` to force consent screen
- Encodes user ID + return URL in state parameter
- Redirects to Google sign-in

**[app/api/oauth/google/callback/route.ts](app/api/oauth/google/callback/route.ts)**
- Handles Google OAuth callback
- Validates state parameter and user session
- Exchanges authorization code for tokens
- Fetches Google profile (email, name, picture)
- Stores connection in database with:
  - `provider: "google"`
  - `accessToken` + `refreshToken`
  - `expiresAt` for token refresh tracking
  - `metadata`: email, name, picture, googleUserId, scope
- Redirects back to original page (builder)

### 2. Connection Listing API

**[app/api/connections/route.ts](app/api/connections/route.ts)**
- GET endpoint: `/api/connections?provider=google`
- Returns all connections owned by current user (per-user isolation)
- Optional provider filter
- Response format:
  ```json
  [
    { "id": "conn_123", "provider": "google", "email": "user@gmail.com", "createdAt": "2026-01-24T..." }
  ]
  ```

### 3. Connection Picker Component

**[components/ConnectionPicker.tsx](components/ConnectionPicker.tsx)**
- Reusable client-side component for node configs
- On mount: fetches `/api/connections?provider=<provider>`
- Features:
  - Dropdown selector with connected emails
  - "➕ Connect <provider>" button (triggers OAuth flow)
  - Auto-selects first connection if none selected
  - Graceful empty state messaging
  - No token exposure to UI
- Integration: Accepts `provider`, `value` (selected ID), `onChange` callback

### 4. Builder Integration

**[app/(main)/(pages)/workflows/[id]/builder/WorkflowBuilderClient.tsx](app/%28main%29/%28pages%29/workflows/%5Bid%5D/builder/WorkflowBuilderClient.tsx)**
- Imported `ConnectionPicker` component
- Replaced manual connection ID inputs with pickers:
  - **Google Forms trigger**: `<ConnectionPicker provider="google" />`
  - **Gmail action**: `<ConnectionPicker provider="google" />`
- Preserved `connectionId`, `bcc` in node configs for save/execute

### 5. Database Schema Update

**[prisma/schema.prisma](prisma/schema.prisma)**
- Removed `@@unique([userId, provider])` constraint
- Allows **multiple Google connections per user** (one for each Google account they sign in with)

## How It Works (User Flow)

### Step 1: Click "Connect Google" in Builder
```
User sees: "No Google account connected yet." + "Connect Google" button
```

### Step 2: Click Button → OAuth Start
```
POST /api/oauth/google/start?returnUrl=http://...builder
↓
Generates Google auth URL
↓
Redirects to: https://accounts.google.com/o/oauth2/v2/auth?...
```

### Step 3: User Authorizes at Google
```
User sees: Google sign-in + permission request
↓
Approves: "Let Autozynq access Google Forms responses & Gmail"
↓
Google redirects to: /api/oauth/google/callback?code=...&state=...
```

### Step 4: OAuth Callback → Store Connection
```
/api/oauth/google/callback
↓
Validate state + exchange code for tokens
↓
Fetch user profile (email, etc.)
↓
INSERT into Connection {
  userId: "fc14e44b-...",
  provider: "google",
  accessToken: "ya29.a0AfH6...",
  refreshToken: "1//0gF...",
  expiresAt: 2026-01-25T...,
  metadata: { email: "user@gmail.com", ... }
}
↓
Redirect back to /workflows/[id]/builder
```

### Step 5: Auto-Refresh Connection Picker
```
<ConnectionPicker /> component:
  1. onMount → fetch /api/connections?provider=google
  2. Render dropdown with: "user@gmail.com"
  3. Auto-select it
  4. Node config now has: connectionId="conn_xyz"
```

### Step 6: Save & Execute Workflow
```
Workflow config persists connectionId
↓
At execution time:
  - Google Forms trigger uses connectionId to fetch form schema
  - Gmail action uses connectionId to send via Gmail API
```

## Key Architecture Decisions

✅ **Nodes never handle OAuth** - Only store `connectionId`  
✅ **OAuth only in API routes** - Secure, server-side  
✅ **UI never sees tokens** - All tokens server-only  
✅ **Multiple connections per provider** - Users can auth multiple Google accounts  
✅ **Extensible pattern** - Add Instagram/WhatsApp OAuth by creating new `/api/oauth/<provider>/*` routes  

## Environment Variables Required

```bash
# OAuth credentials
GOOGLE_OAUTH_CLIENT_ID=<from Google Cloud Console>
GOOGLE_OAUTH_CLIENT_SECRET=<from Google Cloud Console>

# Redirect URI base
APP_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3001

# NextAuth
NEXTAUTH_SECRET=<any random string>
NEXTAUTH_URL=http://localhost:3001

# Database
DATABASE_URL=<PostgreSQL connection string>
```

## Testing Checklist

- [x] Dev server running on port 3001
- [x] Prisma migrations applied (`allow-multiple-connections`)
- [x] `/api/oauth/google/start` compiles and redirects to Google
- [x] Google Forms trigger shows ConnectionPicker
- [x] Gmail action shows ConnectionPicker
- [x] No manual connection ID inputs in builder

## Next Steps (Out of Scope)

1. **Token Refresh Flow**: Auto-refresh expired tokens in execution engine
2. **Error Handling**: Handle revoked connections, failed OAuth
3. **Multi-Provider**: Extend to WhatsApp, Instagram, Slack OAuth
4. **Field Picker UI**: Autocomplete for `{{steps.nodeId.field}}` in input fields
5. **Execution Audit**: Log all Gmail sends with timestamp + status
6. **Connection Management**: UI page to view/revoke connections

## Files Modified

| File | Type | Change |
|------|------|--------|
| `app/api/oauth/google/start/route.ts` | NEW | OAuth start endpoint |
| `app/api/oauth/google/callback/route.ts` | NEW | OAuth callback handler |
| `app/api/connections/route.ts` | NEW | Connection listing API |
| `components/ConnectionPicker.tsx` | NEW | Reusable connection picker |
| `prisma/schema.prisma` | EDIT | Removed unique constraint |
| `WorkflowBuilderClient.tsx` | EDIT | Integrated ConnectionPicker |

## Current Server Status

```
✓ Running on http://localhost:3001
✓ Prisma migrations up-to-date
✓ NextAuth configured
✓ OAuth routes compiled
✓ Builder UI updated
✓ Ready for OAuth testing
```

## Testing OAuth Flow (Manual)

1. Navigate to http://localhost:3001/workflows/[id]/builder
2. Select a Google Forms trigger node
3. See ConnectionPicker with "Connect Google" button
4. Click button → redirects to Google sign-in
5. Sign in with your Google account
6. Approve permissions
7. Redirected back to builder
8. Dropdown now shows your Google email
9. Connection ID auto-saved in node config
10. Workflow ready to execute with real Google + Gmail APIs

---

**Status: Ready for production OAuth testing with Google**  
**Architecture is extensible to other OAuth providers**
