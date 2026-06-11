# Google Form + Email Node Registry Journey

## What we built
- Google Forms trigger: polls responses, normalizes answers by question titles, and hands payloads to the workflow engine.
- Gmail send action: resolves templates from prior step outputs and sends real email via Gmail API with OAuth.

## How it works
1) **Trigger** (`google_forms.trigger.newResponse`)
   - Polls Google Forms API.
   - Uses `questionId` for schema mapping (responses are keyed by questionId, not itemId).
   - Normalizes answers to `{ title: value }`, e.g., `email`, `name`, `message`.
   - Emits payload `{formId, responseId, submittedAt, answers}` to the workflow engine.

2) **Action** (`gmail.action.sendEmail`)
   - Validates config: `connectionId`, `to`, `subject`, `bodyHtml` (cc/bcc optional).
   - Resolves templates like `{{steps.node_<triggerId>.answers.email}}` using previous outputs.
   - Refreshes OAuth tokens and sends via Gmail API; marks connection `needsReauth` if refresh fails.
   - Returns `messageId`, `threadId`, `status`, `to`, `subject`.

3) **Idempotency + locking**
   - Idempotency key = `workflowId:nodeId:responseId` to avoid duplicate executions.
   - Workflow-level lock around execution to prevent concurrent runs.

## Issues we hit and fixes
- **Schema mismatch (no emails sent initially):** Used `itemId` instead of `questionId`; answers mapped to IDs, so templates broke. Fixed by mapping schema IDs to `questionId`.
- **Last-response seeding skipped executions:** Initial poll seeded `lastResponseId` and exited. Removed auto-seed so first poll processes all responses.
- **Malformed Gmail template:** `to` field was `CNUWe.answers.email}}` (missing `{{steps.node_...}}`). Updated to `{{steps.node_-CNUWe.answers.email}}`.
- **Expired Google tokens:** Refresh failed with `invalid_request`; reconnect Google OAuth and retry.
- **Idempotent duplicate on retry:** Older failed response stayed as lastResponseId; resetting `lastResponseId` allowed reprocessing, while idempotency skipped the already failed execution.

## What to check when things fail
- Poll logs: schema questions, response keys, normalized answers.
- Execution detail: Gmail node errors like "Invalid recipient email" or OAuth failures.
- Google connection: ensure Drive+Forms+Gmail scopes; reconnect if refresh fails.
- Templates: `to` must resolve to a valid email, e.g., `{{steps.node_<triggerId>.answers.email}}`.
- Idempotency: if retrying same response, reset `lastResponseId` for the trigger.

## Quick runbook
1) Connect Google (proper scopes).
2) Create workflow: Google Forms trigger → Gmail send.
3) Set Gmail `to`: `{{steps.<triggerNodeId>.answers.email}}`.
4) Submit a fresh Form response (incognito to ensure a new responseId).
5) Run `npm run poll:google-forms`; confirm logs show “Successfully sent email”.
6) If no email, check execution error; fix template or reconnect Google.
