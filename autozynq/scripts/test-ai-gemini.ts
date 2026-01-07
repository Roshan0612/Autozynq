/**
 * Test script for AI Generate Text node with Gemini API
 * 
 * Setup:
 * 1. Get your Gemini API key from: https://makersuite.google.com/app/apikey
 * 2. Add to .env.local: GEMINI_API_KEY=your-key-here
 * 3. Run: npx tsx scripts/test-ai-gemini.ts
 */

import { generateTextAction } from "../lib/nodes/ai/generateText.action";
import { NodeContext } from "../lib/nodes/base";

// Check for API key
if (!process.env.GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY not found in environment");
  console.log("\n📝 Setup instructions:");
  console.log("1. Get your API key from: https://makersuite.google.com/app/apikey");
  console.log("2. Add to .env.local file: GEMINI_API_KEY=your-key-here");
  console.log("3. Restart your dev server (npm run dev)");
  console.log("4. Run this script again");
  process.exit(1);
}

console.log("✅ GEMINI_API_KEY found");
console.log("🚀 Testing AI Generate Text node with Gemini...\n");

// Test 1: Simple prompt
async function test1() {
  console.log("━━━ Test 1: Simple Prompt ━━━");
  const ctx: NodeContext = {
    workflowId: "test-wf",
    executionId: "test-exec",
    node: {
      id: "test-node-1",
      type: "ai.action.generateText",
      config: {
        provider: "gemini",
        model: "gemini-2.0-flash-lite",
        prompt: "Write a creative tagline for a coffee shop in 10 words or less",
        temperature: 0.8,
        maxTokens: 50,
      },
    },
    input: null,
  };

  try {
    const result = await generateTextAction.run(ctx);
    console.log("✅ Success!");
    console.log("Generated text:", result.text);
    console.log("Model:", result.model);
    console.log("Usage:", result.usage);
  } catch (error: any) {
    console.error("❌ Error:", error.message);
  }
  console.log("");
}

// Test 2: With input data and system prompt
async function test2() {
  console.log("━━━ Test 2: With Input Data & System Prompt ━━━");
  const ctx: NodeContext = {
    workflowId: "test-wf",
    executionId: "test-exec",
    node: {
      id: "test-node-2",
      type: "ai.action.generateText",
      config: {
        provider: "gemini",
        model: "gemini-2.0-flash",
        systemPrompt: "You are a professional customer support assistant",
        prompt: "Write a polite response to this customer inquiry",
        temperature: 0.7,
        maxTokens: 150,
      },
    },
    input: {
      customerName: "Sarah",
      inquiry: "I haven't received my order yet. It's been 5 days.",
      orderNumber: "ORD-12345",
    },
  };

  try {
    const result = await generateTextAction.run(ctx);
    console.log("✅ Success!");
    console.log("Generated text:", result.text);
    console.log("Model:", result.model);
    console.log("Usage:", result.usage);
  } catch (error: any) {
    console.error("❌ Error:", error.message);
  }
  console.log("");
}

// Test 3: Error handling (empty prompt)
async function test3() {
  console.log("━━━ Test 3: Validation Error (Empty Prompt) ━━━");
  const ctx: NodeContext = {
    workflowId: "test-wf",
    executionId: "test-exec",
    node: {
      id: "test-node-3",
      type: "ai.action.generateText",
      config: {
        provider: "gemini",
        model: "gemini-2.0-flash",
        prompt: "", // Invalid - empty prompt
      },
    },
    input: null,
  };

  try {
    await generateTextAction.run(ctx);
    console.log("❌ Should have thrown an error!");
  } catch (error: any) {
    console.log("✅ Correctly caught error:", error.message);
  }
  console.log("");
}

// Test 4: Test Gemini 1.5 Pro model
async function test4() {
  console.log("━━━ Test 4: Gemini 2.5 Pro Model ━━━");
  const ctx: NodeContext = {
    workflowId: "test-wf",
    executionId: "test-exec",
    node: {
      id: "test-node-4",
      type: "ai.action.generateText",
      config: {
        provider: "gemini",
        model: "gemini-2.5-pro",
        prompt: "Explain quantum computing in one simple sentence",
        temperature: 0.3,
        maxTokens: 100,
      },
    },
    input: null,
  };

  try {
    const result = await generateTextAction.run(ctx);
    console.log("✅ Success!");
    console.log("Generated text:", result.text);
    console.log("Model:", result.model);
    console.log("Usage:", result.usage);
  } catch (error: any) {
    console.error("❌ Error:", error.message);
  }
  console.log("");
}

// Run all tests
(async () => {
  await test1();
  await test2();
  await test3();
  await test4();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅ All tests completed!");
  console.log("\n📌 Next steps:");
  console.log("1. Create a workflow in the UI");
  console.log("2. Add AI Generate Text node");
  console.log("3. Select 'Google Gemini' as provider");
  console.log("4. Configure your prompt");
  console.log("5. Execute and check results!");
})();
