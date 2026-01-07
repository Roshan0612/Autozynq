/**
 * Test script for AI Generate Text node with Groq API
 * 
 * Setup:
 * 1. Get your Groq API key from: https://console.groq.com
 * 2. Add to .env.local: GROQ_API_KEY=your-key-here
 * 3. Run: npx tsx scripts/test-ai-groq.ts
 */

import { generateTextAction } from "../lib/nodes/ai/generateText.action";
import { NodeContext } from "../lib/nodes/base";

// Check for API key
if (!process.env.GROQ_API_KEY) {
  console.error("❌ GROQ_API_KEY not found in environment");
  console.log("\n📝 Setup instructions:");
  console.log("1. Get your API key from: https://console.groq.com");
  console.log("2. Add to .env.local file: GROQ_API_KEY=your-key-here");
  console.log("3. Restart your dev server (npm run dev)");
  console.log("4. Run this script again");
  process.exit(1);
}

console.log("✅ GROQ_API_KEY found");
console.log("🚀 Testing AI Generate Text node with Groq...\n");

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
        provider: "groq",
        model: "llama-3.3-70b-versatile",
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
        provider: "groq",
        model: "llama-3.3-70b-versatile",
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
        provider: "groq",
        model: "llama-3.3-70b-versatile",
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

// Run all tests
(async () => {
  await test1();
  await test2();
  await test3();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅ All tests completed!");
  console.log("\n📌 Next steps:");
  console.log("1. Create a workflow in the UI");
  console.log("2. Add AI Generate Text node");
  console.log("3. Select 'Groq (Fast LLMs)' as provider");
  console.log("4. Configure your prompt");
  console.log("5. Execute and check results!");
})();
