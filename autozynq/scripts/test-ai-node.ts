/**
 * Test script for AI Generate Text node
 * 
 * Run: npx tsx scripts/test-ai-node.ts
 * 
 * Prerequisites:
 * - Set OPENAI_API_KEY environment variable
 */

import { generateTextAction } from "../lib/nodes/ai";
import { NodeContext } from "../lib/nodes/base";

async function main() {
  console.log("🤖 Testing AI Generate Text Node\n");
  console.log("=".repeat(50));

  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
    console.error("❌ OPENAI_API_KEY not set in environment");
    console.log("\nTo run this test:");
    console.log("1. Get an API key from https://platform.openai.com/api-keys");
    console.log("2. Set it: export OPENAI_API_KEY='your-key-here'");
    console.log("3. Run again: npx tsx scripts/test-ai-node.ts");
    process.exit(1);
  }

  console.log("✅ API key found");
  console.log("\n📋 Test 1: Simple prompt without input\n");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx1: NodeContext = {
    input: null,
    config: {
      provider: "openai",
      model: "gpt-4o-mini",
      prompt: "Write a one-sentence fun fact about automation.",
      temperature: 0.7,
      maxTokens: 100,
    },
    auth: {},
    executionId: "test-exec-1",
    workflowId: "test-workflow-1",
    userId: "test-user",
    stepIndex: 1,
  } as any;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result1 = await generateTextAction.run(ctx1) as any;
    console.log("✅ Test 1 passed");
    console.log("Generated text:", result1.text);
    console.log("Model:", result1.model);
    console.log("Usage:", result1.usage);
  } catch (error) {
    console.error("❌ Test 1 failed:", error);
    process.exit(1);
  }

  console.log("\n" + "=".repeat(50));
  console.log("\n📋 Test 2: Prompt with input data\n");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx2: NodeContext = {
    input: {
      userName: "Alice",
      topic: "artificial intelligence",
    },
    config: {
      provider: "openai",
      model: "gpt-4o-mini",
      systemPrompt: "You are a creative writing assistant.",
      prompt: "Create a personalized greeting based on the user data.",
      temperature: 0.8,
      maxTokens: 150,
    },
    auth: {},
    executionId: "test-exec-2",
    workflowId: "test-workflow-1",
    userId: "test-user",
    stepIndex: 2,
  } as any;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result2 = await generateTextAction.run(ctx2) as any;
    console.log("✅ Test 2 passed");
    console.log("Generated text:", result2.text);
    console.log("Model:", result2.model);
    console.log("Usage:", result2.usage);
  } catch (error) {
    console.error("❌ Test 2 failed:", error);
    process.exit(1);
  }

  console.log("\n" + "=".repeat(50));
  console.log("\n📋 Test 3: Error handling (missing prompt)\n");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx3: NodeContext = {
    input: null,
    config: {
      provider: "openai",
      model: "gpt-4o-mini",
      prompt: "", // Empty prompt should fail validation
      temperature: 0.7,
      maxTokens: 100,
    },
    auth: {},
    executionId: "test-exec-3",
    workflowId: "test-workflow-1",
    userId: "test-user",
    stepIndex: 3,
  } as any;

  try {
    await generateTextAction.run(ctx3);
    console.error("❌ Test 3 failed: Should have thrown validation error");
    process.exit(1);
  } catch (error) {
    console.log("✅ Test 3 passed (expected error)");
    console.log("Error:", error instanceof Error ? error.message : error);
  }

  console.log("\n" + "=".repeat(50));
  console.log("\n🎉 All AI node tests passed!\n");
  console.log("Next steps:");
  console.log("1. Go to /workflows in the app");
  console.log("2. Create a new workflow");
  console.log("3. Add 'AI Generate Text' node from the palette");
  console.log("4. Configure it with a prompt");
  console.log("5. Execute the workflow");
  console.log("6. Check execution details to see AI output\n");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
