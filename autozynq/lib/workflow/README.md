# Workflow Core Domain

## Overview

This directory contains the core automation primitives for the workflow automation platform. It provides the foundational data structures and validation logic that power workflow creation, editing, and execution.

## Architecture

### Domain Models (Prisma)

#### Workflow
Represents a top-level automation created by a user.

**Responsibilities:**
- Owns the workflow graph (nodes + edges stored in JSON)
- Maintains lifecycle states (DRAFT → ACTIVE → PAUSED)
- Links to execution history
- Supports schema evolution without DB migrations

**Key Fields:**
- `id`: Unique identifier (cuid)
- `name`: User-friendly workflow name
- `userId`: Owner reference (FK to User)
- `status`: Lifecycle state (WorkflowStatus enum)
- `definition`: JSON column storing nodes and edges
- `createdAt`, `updatedAt`: Timestamps

#### Execution
Represents a single runtime instance of a workflow.

**Responsibilities:**
- Track execution status (PENDING → RUNNING → SUCCESS/FAILED)
- Enable debugging, logging, and retry logic
- Decouple runtime state from workflow definition

**Key Fields:**
- `id`: Unique identifier (cuid)
- `workflowId`: Reference to parent workflow (FK)
- `status`: Current execution state (ExecutionStatus enum)
- `startedAt`: Execution start time
- `finishedAt`: Completion time (nullable)

### Logical Models (TypeScript + JSON)

#### WorkflowNode
A node is not stored in a separate table; it exists inside `Workflow.definition`.

**Structure:**
```typescript
{
  id: string;              // unique within workflow
  type: string;            // e.g. "gmail.trigger.newEmail" or "slack.action.sendMessage"
  config: Record<string, any>; // node-specific configuration
}
```

**Node Types:**
- **Trigger nodes**: Start the automation (must include ".trigger." or end with ".trigger")
- **Action nodes**: Steps executed after trigger fires

#### WorkflowEdge
Defines connections between nodes.

**Structure:**
```typescript
{
  from: string;  // source node.id
  to: string;    // target node.id
}
```

#### WorkflowDefinition
The complete workflow graph stored in `Workflow.definition`.

**Structure:**
```typescript
{
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}
```

## Validation Rules

### Schema Validation (Zod)
Performed by `workflowDefinitionSchema`:
- Workflows must have at least one node
- Node ids, types must be non-empty strings
- Edge `from`/`to` must reference valid strings
- Config is an optional object (defaults to {})

### Semantic Validation
Performed by `validateWorkflowDefinition()`:

1. **Unique Node IDs**: No duplicate node.id within a workflow
2. **Single Trigger**: Exactly one node must be a trigger (identified by ".trigger." in type)
3. **Valid Edge References**: All edges must reference existing node IDs
4. **Activation Gate**: Workflows can only be activated if they pass all validation

### Why Validation Matters
- **Schema validation** ensures JSON structure is correct
- **Semantic validation** ensures workflow logic is executable
- Validation errors return detailed messages to help users fix issues
- Activation blocks invalid workflows from running

## API Endpoints

### `POST /api/workflows`
Create a new workflow (always starts in DRAFT status).

**Request:**
```json
{
  "name": "Send Slack on Gmail",
  "definition": {
    "nodes": [
      { "id": "trigger1", "type": "gmail.trigger.newEmail", "config": {} },
      { "id": "action1", "type": "slack.action.sendMessage", "config": { "channel": "#alerts" } }
    ],
    "edges": [
      { "from": "trigger1", "to": "action1" }
    ]
  }
}
```

**Response:** `201 Created` with workflow object

### `GET /api/workflows`
List all workflows for authenticated user (ordered by creation date, newest first).

**Response:**
```json
{
  "workflows": [...]
}
```

### `GET /api/workflows/[id]`
Fetch a single workflow by ID (must be owned by authenticated user).

**Response:**
```json
{
  "workflow": { ... }
}
```

### `PATCH /api/workflows/[id]`
Update workflow name, definition, or status.

**Request (partial updates allowed):**
```json
{
  "name": "Updated name",
  "definition": { ... },
  "status": "ACTIVE"
}
```

**Activation Behavior:**
When `status` is set to `"ACTIVE"`, the system validates the definition before saving. If validation fails, the request returns `400 Bad Request` with error details.

## Usage Examples

### Creating a Draft Workflow
```typescript
const response = await fetch('/api/workflows', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'My Automation',
    definition: {
      nodes: [
        { id: 'n1', type: 'webhook.trigger', config: {} },
        { id: 'n2', type: 'email.action.send', config: { to: 'user@example.com' } }
      ],
      edges: [{ from: 'n1', to: 'n2' }]
    }
  })
});

const { workflow } = await response.json();
console.log(workflow.status); // "DRAFT"
```

### Activating a Workflow
```typescript
const response = await fetch(`/api/workflows/${workflowId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: 'ACTIVE' })
});

if (!response.ok) {
  const { error, details } = await response.json();
  console.error('Activation failed:', error, details);
}
```

### Validation Error Example
```json
{
  "error": "Workflow definition failed semantic validation",
  "details": [
    "Workflow must contain exactly one trigger node",
    "Edge 'to' references missing node: action2"
  ]
}
```

## Design Principles

### 1. Flexibility Without Migrations
Node types and configs live in JSON, not as normalized tables. This allows:
- Adding new integrations without schema changes
- Storing arbitrary configuration per node type
- Future execution engines can interpret nodes differently

### 2. Fail-Fast Validation
Workflows are validated at creation and activation, not at execution time. This:
- Prevents invalid workflows from running
- Gives users immediate feedback
- Reduces execution failures

### 3. Separation of Concerns
- **Workflow**: Definition and metadata
- **Execution**: Runtime state and logs
- **Node types**: Implemented separately (future: plugins/connectors)

### 4. User Ownership
All queries filter by `userId` to ensure:
- Users only see their workflows
- Authorization is enforced at the data layer
- Multi-tenant safety

### 5. Production-Grade Error Handling
- Custom error classes prevent leaking implementation details
- Detailed validation messages help users fix issues
- Graceful degradation (e.g., malformed JSON → 400, not 500)

## Future Extensions

### Planned Features (Not Yet Implemented)
- **Execution Engine**: Runner that processes workflows when triggers fire
- **Webhook Infrastructure**: HTTP endpoints for triggering workflows
- **Connector System**: Plugin architecture for Gmail, Slack, etc.
- **Execution Logs**: Store step-level output in Execution records
- **Retry Logic**: Automatic retries on transient failures
- **Branching/Conditionals**: Support for if/else logic in workflows
- **Parallel Execution**: Run independent actions simultaneously

### Extension Points
- `WorkflowNode.type` is a string → can namespace types like `"vendor.category.action"`
- `WorkflowNode.config` is arbitrary JSON → each node type interprets its own config
- `Execution` can store logs/outputs in future JSON fields
- Validation logic can be extended without breaking existing workflows

## Testing Strategies

### Unit Tests (Future)
- Zod schema validation edge cases
- Semantic validation logic (duplicate IDs, missing edges, etc.)
- Trigger node detection (various naming patterns)

### Integration Tests (Future)
- API endpoint authentication
- Workflow CRUD operations
- Activation validation flow
- Cascade deletion (user → workflows → executions)

### Manual Testing
Use tools like Postman or curl to:
1. Create a workflow with invalid definition → expect 400
2. Create a valid workflow → expect 201
3. Activate workflow without trigger → expect 400
4. Activate valid workflow → expect 200

## Files in This Directory

- **`schema.ts`**: Zod schemas for WorkflowNode, WorkflowEdge, WorkflowDefinition
- **`validate.ts`**: Semantic validation logic and custom error class
- **`README.md`**: This documentation

## Related Files

- **`prisma/schema.prisma`**: Database models (Workflow, Execution, enums)
- **`app/api/workflows/route.ts`**: List and create workflows
- **`app/api/workflows/[id]/route.ts`**: Fetch, update, activate workflows
- **`lib/auth/options.ts`**: Shared NextAuth configuration
- **`lib/prisma.ts`**: Prisma client singleton
