# Available Node Types

This is the complete list of automation nodes now available in the platform.

## Triggers (Entry Points)

### Google Forms – New Response
- **Type:** `google_forms.trigger.newResponse`
- **Category:** trigger
- **Description:** Trigger on new Google Form responses via webhook
- **Config:**
  ```json
  {
    "formId": "string (required)",
    "includeAttachments": "boolean (default: false)",
    "conditions": [
      {
        "field": "string",
        "operator": "equals | contains | exists",
        "value": "string (optional)"
      }
    ]
  }
  ```
- **Output:**
  ```json
  {
    "responseId": "string",
    "submittedAt": "ISO string",
    "answers": { "field": "value or string[]" },
    "attachments": ["string"] // optional
  }
  ```

### Webhook Trigger
- **Type:** `core.trigger.webhook`
- **Category:** trigger
- **Description:** Generic webhook trigger for any HTTP POST

### Manual Trigger
- **Type:** `core.trigger.manual`
- **Category:** trigger
- **Description:** Manually trigger workflow execution

### Gmail – New Email
- **Type:** `gmail.trigger.newEmail`
- **Category:** trigger
- **Description:** Trigger on new emails

---

## Actions (Processing)

### AI – Generate Text
- **Type:** `ai.action.generateText`
- **Category:** action
- **Description:** Generate text or extract JSON using an AI model
- **Config:**
  ```json
  {
    "provider": "groq | openai | gemini (default: groq)",
    "model": "string (default: llama-3.3-70b-versatile)",
    "systemPrompt": "string (optional)",
    "userPrompt": "string (required, supports {{field}} templates)",
    "temperature": "number 0-2 (default: 0.7)",
    "maxTokens": "number 1-8000 (default: 500)",
    "outputFormat": {
      "type": "json (optional)",
      "schema": { "field": "type" } // optional
    }
  }
  ```
- **Output:**
  ```json
  {
    "text": "string (optional)",
    "json": { "field": "any" }, // optional
    "model": "string",
    "usage": {
      "promptTokens": number,
      "completionTokens": number,
      "totalTokens": number
    }
  }
  ```

### Gmail – Send Email
- **Type:** `gmail.action.sendEmail`
- **Category:** action
- **Description:** Send an email via Gmail
- **Config:**
  ```json
  {
    "to": "string (required, supports {{field}} templates)",
    "cc": "string (optional, supports {{field}} templates)",
    "subject": "string (required, supports {{field}} templates)",
    "bodyHtml": "string (required, supports {{field}} templates)"
  }
  ```
- **Output:**
  ```json
  {
    "messageId": "string",
    "status": "sent"
  }
  ```

### WhatsApp – Send Message
- **Type:** `whatsapp.action.sendMessage`
- **Category:** action
- **Description:** Send a message via WhatsApp
- **Config:**
  ```json
  {
    "phoneNumber": "string (required, supports {{field}} templates)",
    "message": "string (required, supports {{field}} templates)"
  }
  ```
- **Output:**
  ```json
  {
    "messageId": "string",
    "delivered": true
  }
  ```

### Instagram – Create Post
- **Type:** `instagram.action.createPost`
- **Category:** action
- **Description:** Create a post on Instagram with image and caption
- **Config:**
  ```json
  {
    "imageUrl": "string (required, supports {{field}} templates)",
    "caption": "string (required, supports {{field}} templates)",
    "publishImmediately": "boolean (default: true)"
  }
  ```
- **Output:**
  ```json
  {
    "postId": "string",
    "url": "string"
  }
  ```

### Slack – Send Message
- **Type:** `slack.action.sendMessage`
- **Category:** action
- **Description:** Send a message to Slack

### HTTP Request
- **Type:** `core.action.httpRequest`
- **Category:** action
- **Description:** Make an HTTP request

### Log Debug
- **Type:** `core.action.logDebug`
- **Category:** action
- **Description:** Log debug information

### Email – Send (SMTP)
- **Type:** `email.action.smtpSend`
- **Category:** action
- **Description:** Send email via SMTP

### AI – Generate Email
- **Type:** `ai.action.generateEmail`
- **Category:** action
- **Description:** Generate email content using AI

---

## Logic (Conditions & Branching)

### If Condition
- **Type:** `core.logic.ifCondition`
- **Category:** logic
- **Description:** Conditional branching based on field values
- **Config:**
  ```json
  {
    "condition": "javascript expression",
    "thenPath": "string (node ID)",
    "elsePath": "string (node ID)"
  }
  ```

### Test Passthrough
- **Type:** `test.trigger.passthrough`
- **Category:** trigger
- **Description:** Test trigger that passes through input

---

## Template Interpolation

All action nodes support template interpolation in string fields using the syntax:

```
{{fieldName}}
{{object.nested.field}}
{{arrayName.0}}
```

Examples:
- `to: "{{email}}"` - Uses `email` from previous output
- `subject: "Hello {{user.name}}"` - Uses nested field
- `message: "Response ID: {{responseId}}"` - Any output field

---

## Node Categories

### Triggers (Entry Points)
- Can start a workflow execution
- Run once per trigger event
- Pass output to first action

### Actions (Processing)
- Receive input from previous node
- Process and transform data
- Pass output to next action
- Can send to external systems

### Logic (Branching)
- Evaluate conditions
- Route to different paths
- Merge execution paths

---

## Total Nodes Available: 20+

- ✅ 5 triggers (Google Forms, Webhook, Manual, Gmail, Test)
- ✅ 11 actions (AI Generate, Gmail, WhatsApp, Instagram, Slack, HTTP, Log, Email, AI Email)
- ✅ 1 logic node (If Condition)
- ✅ Plus additional utility nodes

---

## Next Steps

1. **Create a Workflow**
   - Select trigger (Google Forms, Webhook, Manual)
   - Add actions (AI, Gmail, WhatsApp, Instagram)
   - Connect with edges
   - Configure each node

2. **Configure Nodes**
   - Fill in required fields
   - Use {{}} templates for dynamic values
   - Set advanced options as needed

3. **Activate & Test**
   - Activate workflow
   - Send test event/webhook
   - Monitor execution in Debug UI
   - View step outputs and logs

4. **Scale**
   - Deploy workflow
   - Connect real webhooks
   - Integrate with APIs
   - Monitor and optimize

---

## Adding New Nodes

To add a new node:

1. Create `lib/nodes/[service]/` directory
2. Implement `[action].ts` with AutomationNode interface
3. Export nodes in `index.ts`
4. Import and spread into registry in `lib/nodes/registry.ts`
5. Run verification script

See `NODES_IMPLEMENTATION.md` for detailed examples.
