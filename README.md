# Autozynq

Autozynq is a visual workflow automation application. Authenticated users build workflows from trigger, action, and logic nodes, connect supported services, activate workflows, and inspect their execution history.

## Overview

Autozynq stores workflow definitions as node-and-edge graphs. A workflow can be run manually or activated behind a generated webhook endpoint. When a trigger fires, the execution engine traverses the graph, resolves values from previous node outputs, evaluates conditional branches, and records the result and per-node steps in PostgreSQL.

The application provides a dashboard for workflows, executions, trigger subscriptions, and connected accounts. Google Forms and Google Sheets triggers can also be polled through the provided polling endpoint or script.

## Key Features

- Visual workflow builder powered by React Flow.
- Manual and webhook triggers, with generated webhook URLs when workflows are activated.
- Google Forms new-response and Google Sheets new-row triggers.
- Actions for HTTP requests, debug logging, SMTP email, Gmail, Google Forms, Google Sheets, and Google Drive.
- AI text and email generation through configured model providers.
- Conditional `if` logic with `equals`, `notEquals`, `greaterThan`, `lessThan`, and `contains` comparisons.
- Template values resolved from earlier node outputs, such as `{{steps.<nodeId>.<field>}}`.
- Execution history with statuses, outputs, errors, and step-level details.
- Execution cancellation, idempotency handling, cycle protection, and one-execution-per-workflow locking.
- Email/password signup and sign-in, plus GitHub and Google OAuth providers.
- OAuth connection management with Google token refresh and scope checks.

## Architecture

```text
Browser
  -> Next.js App Router pages and React Flow builder
  -> Next.js route handlers
  -> Workflow and connection services
  -> Prisma Client
  -> PostgreSQL

External webhook or polling job
  -> /api/webhooks/[triggerId]
  -> idempotent execution request
  -> workflow execution engine
  -> registered node implementations
  -> execution records and step outputs
```

The main application runs in Next.js. Server-side route handlers authenticate requests, authorize access to user-owned workflows, and call services in `lib/`. Prisma persists users, OAuth accounts, connections, workflows, trigger subscriptions, executions, and execution locks. The node registry is the execution engine's source of truth for available node types.

When a workflow is activated, its definition is validated and a trigger subscription is created. Webhook requests must contain a JSON object; an optional `x-signature` header can be checked with an HMAC SHA-256 secret. The engine executes one path at a time and follows conditional edges based on logic-node output.

## Tech Stack

- **Frontend:** Next.js 15 App Router, React 19, React Flow, Tailwind CSS 3, Radix UI primitives, lucide-react, next-themes
- **Backend:** Next.js route handlers, TypeScript, Zod
- **Database:** PostgreSQL with Prisma 5
- **Authentication:** NextAuth v4, Prisma Adapter, bcryptjs, credentials authentication, GitHub OAuth, and Google OAuth
- **External APIs:** Google APIs for OAuth, Gmail, Forms, Sheets, and Drive
- **Email and AI:** Nodemailer for SMTP delivery; optional Gemini, Groq, or OpenAI providers for AI nodes

## Integrations

### Google

Google OAuth connections are used by Gmail, Google Forms, Google Sheets, and Google Drive nodes. The application refreshes expired Google access tokens and checks required scopes before activating workflows that need them.

Supported Google operations include:

- Gmail: send email
- Google Forms: list forms, inspect form schemas, read forms and responses, list responses, and watch for new responses
- Google Sheets: list spreadsheets and sheets, inspect columns, read/search rows, create rows, update rows, and watch for new rows
- Google Drive: list folders, create folders, and set sharing preferences

### Other actions

- **HTTP:** Send configured HTTP requests.
- **SMTP:** Send email through a configured SMTP server.
- **AI:** Generate text or email content through the provider selected in the node configuration.

## Project Structure

```text
.
├── package.json                 # Workspace scripts for development and builds
├── autozynq/
│   ├── app/                     # Pages, dashboard, builder, auth, and API routes
│   ├── components/              # Shared React components
│   ├── lib/
│   │   ├── execution/           # Runtime engine, locks, idempotency, templates
│   │   ├── integrations/        # Google OAuth and API clients
│   │   ├── nodes/                # Node implementations and central registry
│   │   ├── triggers/             # Webhook subscriptions and polling
│   │   └── workflow/             # Definition validation and activation
│   ├── prisma/
│   │   └── schema.prisma         # PostgreSQL data model
│   ├── scripts/                  # Polling and local utility scripts
│   └── package.json              # Next.js package scripts and dependencies
└── collected-markdown/           # Collected project documentation
```

## Getting Started

### Prerequisites

- Node.js with npm
- A PostgreSQL database
- OAuth applications and/or API credentials for the providers you plan to use

### Installation

From the repository root:

```bash
npm install
```

Generate the Prisma client and apply development migrations:

```bash
cd autozynq
npx prisma generate
npx prisma migrate dev
cd ..
```

Create `autozynq/.env.local` using the variables below, then start the development server:

```bash
npm run dev
```

The application is available at `http://localhost:3000` by default.

## Environment Variables

Store secrets in `autozynq/.env.local`. Do not commit this file.

### Core application variables

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"
NEXTAUTH_SECRET="replace-with-a-long-random-secret"
NEXTAUTH_URL="http://localhost:3000"
```

`DATABASE_URL` and `NEXTAUTH_SECRET` are required. Set `NEXTAUTH_URL` to the public application URL outside local development because it is used for authentication redirects and generated webhook URLs.

### Authentication providers

These are optional individually, but required for the corresponding OAuth sign-in option:

```env
GITHUB_ID="your-github-oauth-client-id"
GITHUB_SECRET="your-github-oauth-client-secret"
GOOGLE_ID="your-google-oauth-client-id"
GOOGLE_SECRET="your-google-oauth-client-secret"
```

Email/password authentication uses the database and does not require either OAuth provider.

### Google service connections

Required when using Google integrations or Google service nodes:

```env
GOOGLE_OAUTH_CLIENT_ID="your-google-oauth-client-id"
GOOGLE_OAUTH_CLIENT_SECRET="your-google-oauth-client-secret"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Register `/api/oauth/google/callback` as an authorized redirect URI. `APP_URL` is also accepted as a server-side fallback for the public application URL.

### Optional feature variables

```env
# AI nodes: configure the provider used by each node
GEMINI_API_KEY="your-gemini-api-key"
GROQ_API_KEY="your-groq-api-key"
OPENAI_API_KEY="your-openai-api-key"

# SMTP email node
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_USER="smtp-user"
SMTP_PASS="smtp-password"
SMTP_FROM="noreply@example.com"
SMTP_SECURE="false"

# HMAC verification for signed webhook requests
WEBHOOK_SECRET="replace-with-a-webhook-secret"
```

AI and SMTP variables are only needed by workflows using those nodes. `GOOGLE_FORMS_WEBHOOK_SECRET` is also recognized as a legacy alternative to `WEBHOOK_SECRET`.

## Usage

1. Create an account or sign in.
2. Open the dashboard and create a workflow.
3. Add a trigger, action, or logic node in the workflow builder.
4. Configure provider connections and node settings, then connect the nodes with edges.
5. Save and activate the workflow. Activation validates the graph and returns a webhook URL for webhook-backed triggers.
6. Send a JSON object to the generated URL, or use the manual execution control.
7. Review execution status, outputs, errors, trigger payloads, and step details in the executions and trigger views.

Google Forms polling can be run through the application endpoint:

```text
GET /api/cron/poll-triggers
```

It can also be run locally with:

```bash
npm run poll:google-forms
```

A deployed environment needs an external scheduler or cron service to request the polling endpoint at the desired interval. No scheduler configuration is included in this repository.

## Deployment

The project uses the standard Next.js production commands:

```bash
npm run build
npm run start
```

Provide the production PostgreSQL connection, authentication variables, provider credentials, and public URL through the deployment platform's secret/environment-variable configuration. Run Prisma migrations against the production database before starting the application. The deployment must expose the webhook route publicly and, if polling is required, provide an external scheduled request to `/api/cron/poll-triggers`.

No platform-specific deployment configuration or hosted deployment URL is included in the repository.


## Live Demo / Repository

- Live demo: `[https://autozynq-9bs2.vercel.app/]`
- Repository: `[https://github.com/Roshan0612/Autozynq]`



