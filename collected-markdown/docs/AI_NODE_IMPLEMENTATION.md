# AI Generate Text Node - Implementation Guide

## Overview

The AI Generate Text node allows workflows to call OpenAI's API to generate text based on prompts. This is similar to AI actions in Zapier or Make.com.

## Node Details

- **Type**: `ai.action.generateText`
- **Category**: `action`
- **Display Name**: AI Generate Text
- **App**: AI

## Configuration

### Required Fields
- `prompt` (string): The text prompt for the AI model

### Optional Fields
- `provider` (enum): AI provider - currently only "openai" (default: "openai")
- `model` (string): Model to use (default: "gpt-4o-mini")
  - Options: gpt-4o-mini, gpt-4o, gpt-4-turbo, gpt-3.5-turbo
- `systemPrompt` (string): System instructions for the AI
- `temperature` (number 0-2): Creativity level (default: 0.7)
  - Lower = more focused and deterministic
  - Higher = more creative and random
- `maxTokens` (number 1-4000): Maximum response length (default: 500)

### Input
The node accepts any input from the previous node. If provided, it will be appended to the prompt as context.

### Output
```typescript
{
  text: string,           // Generated text
  model: string,          // Model that was used
  usage?: {               // Token usage stats (if available)
    promptTokens?: number,
    completionTokens?: number,
    totalTokens?: number
  }
}
```

## Setup

### 1. Environment Variable

Set your OpenAI API key:

```bash
# .env.local or .env
OPENAI_API_KEY=sk-your-key-here
```

Get your API key from: https://platform.openai.com/api-keys

### 2. Test the Node

Run the test script to verify everything works:

```bash
npx tsx scripts/test-ai-node.ts
```

This will:
- Verify the API key is set
- Test basic text generation
- Test with input data
- Test error handling

## Usage in Workflows

### Example 1: Simple Text Generation

```json
{
  "nodes": [
    {
      "id": "trigger1",
      "type": "trigger.manual",
      "config": {}
    },
    {
      "id": "ai1",
      "type": "ai.action.generateText",
      "config": {
        "model": "gpt-4o-mini",
        "prompt": "Write a creative tagline for a coffee shop",
        "temperature": 0.8,
        "maxTokens": 50
      }
    },
    {
      "id": "log1",
      "type": "action.log.debug",
      "config": {
        "message": "Generated tagline"
      }
    }
  ],
  "edges": [
    { "from": "trigger1", "to": "ai1" },
    { "from": "ai1", "to": "log1" }
  ]
}
```

### Example 2: AI with Dynamic Input

```json
{
  "nodes": [
    {
      "id": "webhook1",
      "type": "trigger.webhook.basic",
      "config": {}
    },
    {
      "id": "ai1",
      "type": "ai.action.generateText",
      "config": {
        "model": "gpt-4o-mini",
        "systemPrompt": "You are a customer support assistant",
        "prompt": "Respond professionally to this customer inquiry",
        "temperature": 0.7
      }
    },
    {
      "id": "http1",
      "type": "action.http.request",
      "config": {
        "url": "https://api.example.com/replies",
        "method": "POST"
      }
    }
  ],
  "edges": [
    { "from": "webhook1", "to": "ai1" },
    { "from": "ai1", "to": "http1" }
  ]
}
```

In this example:
- Webhook receives customer inquiry data
- AI generates a professional response using the webhook data as context
- HTTP request sends the generated response to an API

## Builder UI

### Adding the Node

1. Open a workflow in the builder
2. Click the "+" button under a node or "Add node" on empty canvas
3. Select "AI Generate Text" from the action list
4. Configure the prompt and other settings
5. Save the workflow

### Configuration Panel

The AI node config panel includes:
- **Model dropdown**: Select which GPT model to use
- **System Prompt textarea**: Optional instructions (e.g., "You are a helpful assistant")
- **Prompt textarea**: Main prompt text (required)
- **Temperature slider**: 0.0 to 2.0 with visual feedback
- **Max Tokens input**: Number field for response length

## Execution Details

When a workflow executes:
1. The AI node receives input from the previous node (if any)
2. It merges the input with the configured prompt
3. Calls OpenAI API with the specified model and parameters
4. Returns structured output with generated text
5. The next node receives this output as its input

### Viewing Results

In the Execution Detail page:
- Generated text is displayed in the step output
- Model name and token usage are shown
- Any errors are clearly logged

## Error Handling

The node throws clear errors for:
- Missing OPENAI_API_KEY
- Empty or invalid prompt
- API connection failures
- Invalid API responses
- Rate limiting or quota issues

Errors are logged in the execution and visible in the UI.

## Files Modified/Created

### New Files
- `lib/nodes/ai/generateText.action.ts` - Main node implementation
- `lib/nodes/ai/index.ts` - AI module exports
- `scripts/test-ai-node.ts` - Test script

### Modified Files
- `lib/nodes/registry.ts` - Registered AI node
- `app/(main)/(pages)/workflows/[id]/builder/WorkflowBuilderClient.tsx`
  - Added AI node to NODE_LIBRARY
  - Added config panel for AI node

## Limitations (By Design)

The following are intentionally NOT implemented:
- ❌ Streaming responses
- ❌ Retry logic
- ❌ OAuth authentication
- ❌ Multiple AI providers
- ❌ Cost tracking
- ❌ Rate limiting
- ❌ Response caching
- ❌ Parallel requests

This is a simple, demo-ready implementation focused on core functionality.

## Next Steps

To extend this implementation:
1. Add support for other providers (Anthropic, Cohere, etc.)
2. Implement streaming for real-time responses
3. Add cost tracking per execution
4. Support function calling / tools
5. Add response caching for repeated prompts
6. Implement rate limiting and queue system

## Troubleshooting

### "OPENAI_API_KEY not found"
- Set the environment variable in `.env.local`
- Restart the dev server after adding the key

### "API request failed"
- Check your API key is valid
- Verify you have credits in your OpenAI account
- Check network connectivity

### "Generated text is cut off"
- Increase `maxTokens` in the node config
- Note: Higher tokens = higher cost

### Node doesn't appear in builder
- Verify the node is imported in `registry.ts`
- Check the browser console for errors
- Restart the dev server

## API Costs

Be aware of OpenAI API costs:
- GPT-4o Mini: ~$0.00015 per 1K tokens (cheapest)
- GPT-4o: ~$0.0025 per 1K tokens
- GPT-4 Turbo: ~$0.01 per 1K tokens

For development, use `gpt-4o-mini` to minimize costs.
